/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Direct SDK bridge for Electron app with smart method dispatching.
 * Provides automatic snake_case to camelCase conversion and model serialization.
 *
 * @module main/services/datalayer-sdk-bridge
 */

import { DatalayerClient } from '@datalayer/core/lib/client/index';
import type { UserJSON } from '@datalayer/core/lib/client/models/User';
import { safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import log from 'electron-log';
import type { AuthState, SerializedData } from '../../shared/types/ipc.types';

/**
 * Direct SDK bridge with smart method dispatching.
 * Provides direct SDK access with IPC-safe serialization and secure token storage.
 */
export class DatalayerSDKBridge {
  private sdk: DatalayerClient;
  private initialized = false;
  private _tokenPath?: string; // Lazy-loaded
  private currentUser: UserJSON | null = null;

  /**
   * Get the token storage path (lazy-loaded).
   * @returns Token storage file path
   */
  private get tokenPath(): string {
    if (!this._tokenPath) {
      // This will be called after app is ready
      this._tokenPath = join(app.getPath('userData'), '.datalayer-token');
    }
    return this._tokenPath;
  }

  constructor() {
    // Don't access app or any Electron APIs here - module may not be fully loaded yet

    this.sdk = new DatalayerClient({
      handlers: {
        beforeCall: (method, args) => {
          log.debug(`[SDK] → ${method}`, { argsCount: args.length });
        },
        afterCall: method => {
          log.debug(`[SDK] ${method} completed`);
        },
        onError: (method, error) => {
          log.error(
            `[SDK] ${method} failed:`,
            error instanceof Error ? error.message : String(error)
          );
        },
      },
    });
  }

  /**
   * Initialize the SDK bridge.
   * Restores authentication from stored token if available. Call after app is ready.
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.initialized = true;

      // App must be ready before calling this method (checked by caller)
      // Try to restore stored token on startup
      const storedToken = this.loadStoredToken();
      if (storedToken) {
        try {
          log.info(
            '[SDK Bridge] Found stored token, attempting to restore authentication...'
          );
          await this.sdk.setToken(storedToken);

          // Verify the token is still valid
          const user = await this.sdk.whoami();
          // Use the User model's toJSON method to get all properties
          this.currentUser = user.toJSON();
          log.info(
            '[SDK Bridge] Successfully restored authentication for user:',
            {
              email: this.currentUser.email,
              firstName: this.currentUser.firstName,
              lastName: this.currentUser.lastName,
              avatarUrl: this.currentUser.avatarUrl,
              handle: this.currentUser.handle,
            }
          );
        } catch {
          log.warn('[SDK Bridge] Stored token is invalid, clearing...');
          this.clearStoredToken();
          this.currentUser = null;
          await this.sdk.setToken('');
        }
      } else {
        log.info('[SDK Bridge] No stored authentication found');
      }

      log.info('[SDK Bridge] Initialized with direct SDK access');
    }
  }

  /**
   * Save token securely using Electron's safeStorage with fallback.
   * Falls back to base64 encoding if system encryption is unavailable (common on Linux).
   * @param token - Authentication token to save
   */
  private saveToken(token: string): void {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token);
        writeFileSync(this.tokenPath, encrypted);
        log.info('[SDK Bridge] Token saved with system encryption');
      } else {
        // Fallback: Use base64 encoding (better than nothing, especially on Linux)
        log.warn(
          '[SDK Bridge] System encryption unavailable (gnome-keyring/kwallet not found), using fallback storage'
        );
        const encoded = Buffer.from(token, 'utf-8').toString('base64');
        // Prefix to distinguish from encrypted tokens
        writeFileSync(this.tokenPath, `FALLBACK:${encoded}`);
        log.info('[SDK Bridge] Token saved with fallback encoding');
      }
    } catch (error) {
      log.error('[SDK Bridge] Failed to save token:', error);
    }
  }

  /**
   * Load stored token from secure storage with fallback support.
   * Handles both system-encrypted tokens and fallback base64-encoded tokens.
   * @returns Decrypted token or null if not found
   */
  private loadStoredToken(): string | null {
    try {
      if (existsSync(this.tokenPath)) {
        const fileContent = readFileSync(this.tokenPath, 'utf-8');

        // Check if this is a fallback-encoded token
        if (fileContent.startsWith('FALLBACK:')) {
          const encoded = fileContent.substring(9); // Remove "FALLBACK:" prefix
          const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
          log.info('[SDK Bridge] Token loaded from fallback storage');
          return decoded;
        }

        // Otherwise, try system encryption
        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = readFileSync(this.tokenPath);
          const decrypted = safeStorage.decryptString(encrypted);
          log.info('[SDK Bridge] Token loaded from system encryption');
          return decrypted;
        }

        log.warn(
          '[SDK Bridge] Token file exists but encryption is unavailable and no fallback prefix found'
        );
      }
    } catch (error) {
      log.error('[SDK Bridge] Failed to load stored token:', error);
    }
    return null;
  }

  /**
   * Clear stored token.
   */
  private clearStoredToken(): void {
    try {
      if (existsSync(this.tokenPath)) {
        unlinkSync(this.tokenPath);
        log.debug('[SDK Bridge] Stored token cleared');
      }
    } catch (error) {
      log.error('[SDK Bridge] Failed to clear stored token:', error);
    }
  }

  /**
   * Smart method dispatcher with automatic case conversion.
   * Handles special cases for login/logout/whoami and serializes results for IPC.
   *
   * @param method - Method name (snake_case or camelCase)
   * @param args - Method arguments
   * @returns Serialized result safe for IPC transmission
   */
  async call(method: string, ...args: unknown[]): Promise<unknown> {
    await this.initialize();

    const camelMethod = this.toCamelCase(method);

    // Special handling for login to save token
    if (camelMethod === 'login' && args.length > 0) {
      const token = args[0];
      if (typeof token !== 'string') {
        throw new Error('Login token must be a string');
      }
      const result = await this.sdk.login(token);

      // Save the token securely after successful login
      this.saveToken(token);
      // Use the User model's toJSON method to get all properties
      this.currentUser = result.toJSON();

      log.info('[SDK Bridge] Login successful, token saved securely');
      return this.currentUser;
    }

    // Special handling for logout to clear token
    if (camelMethod === 'logout') {
      const result = await this.sdk.logout();

      // Clear the stored token
      this.clearStoredToken();
      this.currentUser = null;

      log.info('[SDK Bridge] Logout successful, token cleared');
      return this.serializeForIPC(result);
    }

    // Special handling for whoami to update current user
    if (camelMethod === 'whoami') {
      const result = await this.sdk.whoami();
      // Use the User model's toJSON method to get all properties
      this.currentUser = result.toJSON();
      return this.currentUser;
    }

    // Dynamic SDK method invocation - necessary for reflective IPC bridge
    // This allows the renderer to call any SDK method without duplicating interfaces
    // DatalayerClient interface has index signature [key: string]: unknown
    const sdkMethod = this.sdk[camelMethod as keyof DatalayerClient];

    if (typeof sdkMethod !== 'function') {
      throw new Error(`SDK method '${camelMethod}' not found`);
    }

    log.debug(`[SDK Bridge] ${method} → ${camelMethod}`, {
      args: args.slice(0, 2),
    });

    // Call the SDK method - it's guaranteed to be a function by the check above
    const result = await (
      sdkMethod as (...args: unknown[]) => Promise<unknown>
    ).apply(this.sdk, args);

    // Convert models to JSON for IPC transmission
    return this.serializeForIPC(result);
  }

  /**
   * Convert snake_case to camelCase.
   * @param str - String to convert
   * @returns Camel-cased string
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Serialize data for safe IPC transmission.
   * Converts SDK models using toJSON() method.
   * @param data - Data to serialize
   * @returns IPC-safe serialized data
   */
  private serializeForIPC(data: unknown): SerializedData {
    if (!data) return data;

    // Handle SDK models with toJSON method
    if (
      typeof data === 'object' &&
      data !== null &&
      'toJSON' in data &&
      typeof data.toJSON === 'function'
    ) {
      return data.toJSON();
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.serializeForIPC(item));
    }

    // Handle plain objects
    if (typeof data === 'object' && data.constructor === Object) {
      const serialized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serializeForIPC(value);
      }
      return serialized;
    }

    // Return primitives as-is
    return data;
  }

  /**
   * Get direct SDK access for complex operations.
   * @returns DatalayerClient instance
   */
  getSDK(): DatalayerClient {
    return this.sdk;
  }

  /**
   * Get SDK configuration for debugging.
   * @returns SDK configuration object
   */
  getConfig() {
    return this.sdk.getConfig();
  }

  /**
   * Check if SDK is initialized.
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current authentication state.
   * @returns Authentication state with user info and token
   */
  getAuthState(): AuthState {
    const config = this.sdk.getConfig();
    return {
      isAuthenticated: !!config.token && !!this.currentUser,
      user: this.currentUser,
      token: config.token || null,
      runUrl: config.iamRunUrl || 'https://prod1.datalayer.run',
    };
  }

  /**
   * Check if user is authenticated.
   * @returns True if authenticated
   */
  isAuthenticated(): boolean {
    const config = this.sdk.getConfig();
    return !!config.token && !!this.currentUser;
  }
}

/**
 * Singleton SDK bridge instance.
 */
export const sdkBridge = new DatalayerSDKBridge();
