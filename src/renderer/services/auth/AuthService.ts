/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module services/auth/AuthService
 *
 * Authentication service implementation using dependency injection.
 * Manages user authentication and session state without global state.
 */

import { DatalayerClient } from '@datalayer/core/lib/client';
import { BaseService } from '../core/BaseService';
import { ILogger } from '../interfaces/ILogger';
import {
  IAuthService,
  AuthState,
  AuthStateChange,
} from '../interfaces/IAuthService';
import { User } from '../../../shared/types';

/**
 * Event callback for auth state changes.
 */
type AuthStateCallback = (change: AuthStateChange) => void;

/**
 * Authentication service implementation using dependency injection.
 * No global state - all state managed internally.
 */
export class AuthService extends BaseService implements IAuthService {
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    runUrl: '',
  };

  private stateChangeCallbacks = new Set<AuthStateCallback>();

  constructor(
    // @ts-ignore - Reserved for future SDK direct usage
    private readonly sdk: DatalayerClient,
    logger: ILogger
  ) {
    super('AuthService', logger);
  }

  protected async onInitialize(): Promise<void> {
    // Load initial auth state from secure storage
    try {
      if (window.datalayerClient?.getAuthState) {
        const initialState = await window.datalayerClient.getAuthState();
        this.updateAuthState(initialState);
      }
    } catch (error) {
      this.logger.error('Failed to load initial auth state', error as Error);
    }

    // Listen for auth state changes from main process
    if (window.electronAPI?.onAuthStateChanged) {
      window.electronAPI.onAuthStateChanged(newState => {
        this.updateAuthState(newState);
      });
    }

    this.logger.info('AuthService initialized', {
      isAuthenticated: this.authState.isAuthenticated,
    });
  }

  protected async onDispose(): Promise<void> {
    // Cleanup listeners
    if (window.electronAPI?.removeAuthStateListener) {
      window.electronAPI.removeAuthStateListener();
    }

    this.stateChangeCallbacks.clear();
    this.logger.info('AuthService disposed');
  }

  /**
   * Get current authentication state.
   */
  async getAuthState(): Promise<AuthState> {
    this.assertReady();
    return { ...this.authState };
  }

  /**
   * Login user with provided credentials.
   */
  async login(runUrl: string, token: string): Promise<User> {
    this.assertReady();

    try {
      this.logger.info('Attempting login', { runUrl });

      // Login via secure IPC
      if (!window.datalayerClient?.login) {
        throw new Error('Login method not available');
      }

      await window.datalayerClient.login(token);

      // Get updated auth state and user data
      const newAuthState = await window.datalayerClient.getAuthState();
      this.updateAuthState(newAuthState);

      // Get user data from the client
      const userData = await window.datalayerClient.whoami();

      if (!userData) {
        throw new Error('Login failed: No user data returned');
      }

      this.logger.info('Login successful', {
        userId: userData.id,
      });

      return userData as User;
    } catch (error) {
      this.logger.error('Login failed', error as Error);
      throw error;
    }
  }

  /**
   * Logout current user.
   */
  async logout(): Promise<void> {
    this.assertReady();

    try {
      this.logger.info('Logging out user');

      // Logout via secure IPC
      if (window.datalayerClient?.logout) {
        await window.datalayerClient.logout();
      }

      // Update local state
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        runUrl: '',
      });

      this.logger.info('Logout successful');
    } catch (error) {
      this.logger.error('Logout failed', error as Error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Get current user.
   */
  getCurrentUser(): User | null {
    return this.authState.user;
  }

  /**
   * Subscribe to authentication state changes.
   */
  onAuthStateChanged(callback: AuthStateCallback): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Update auth state and notify listeners.
   */
  private updateAuthState(newState: Partial<AuthState>): void {
    const previous = { ...this.authState };
    this.authState = { ...this.authState, ...newState };

    // Notify listeners
    const change: AuthStateChange = {
      previous,
      current: { ...this.authState },
    };

    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(change);
      } catch (error) {
        this.logger.error(
          'Error in auth state change callback',
          error as Error
        );
      }
    }
  }
}
