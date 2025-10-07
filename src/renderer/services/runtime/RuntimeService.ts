/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module services/runtime/RuntimeService
 *
 * Runtime service implementation using dependency injection.
 * Manages compute runtime lifecycle for notebooks without global state.
 */

import { ServiceManager } from '@jupyterlab/services';
import { DatalayerClient } from '@datalayer/core/lib/client';
import { BaseService } from '../core/BaseService';
import { ILogger } from '../interfaces/ILogger';
import {
  IRuntimeService,
  Runtime,
  RuntimeOptions,
  RuntimeStateChange,
} from '../interfaces/IRuntimeService';

/**
 * Associates a notebook with its runtime and service manager.
 */
interface NotebookRuntime {
  notebookId: string;
  notebookPath?: string;
  runtime: Runtime;
  serviceManager?: ServiceManager.IManager;
}

/**
 * Event callback for runtime state changes.
 */
type RuntimeStateCallback = (change: RuntimeStateChange) => void;

/**
 * Runtime service implementation using dependency injection.
 * No global state, no singletons - all dependencies injected.
 */
export class RuntimeService extends BaseService implements IRuntimeService {
  // Instance state (not global)
  private notebookRuntimes = new Map<string, NotebookRuntime>();
  private expirationTimers = new Map<string, NodeJS.Timeout>();
  private runtimeCreationPromises = new Map<string, Promise<Runtime>>();
  private stateChangeCallbacks = new Set<RuntimeStateCallback>();

  // Platform-wide runtime list (for runtime selection)
  private allRuntimes: Runtime[] = [];
  private lastRuntimesFetch: number | null = null;
  private readonly RUNTIME_CACHE_TTL = 30000; // 30 seconds

  // Global runtime expiration monitoring
  private globalExpirationTimers = new Map<string, NodeJS.Timeout>();
  private globalExpirationCallbacks = new Set<(podName: string) => void>();

  constructor(
    // @ts-ignore - Reserved for future SDK direct usage
    private readonly sdk: DatalayerClient,
    logger: ILogger
  ) {
    super('RuntimeService', logger);
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('RuntimeService initialized');
  }

  protected async onDispose(): Promise<void> {
    // Clear all timers
    this.clearAllExpirationTimers();

    // Dispose all service managers
    for (const [, notebookRuntime] of this.notebookRuntimes) {
      if (notebookRuntime.serviceManager) {
        notebookRuntime.serviceManager.dispose();
      }
    }

    this.notebookRuntimes.clear();
    this.runtimeCreationPromises.clear();
    this.stateChangeCallbacks.clear();

    this.logger.info('RuntimeService disposed');
  }

  /**
   * Create a runtime for a specific notebook.
   */
  async createRuntime(
    notebookId: string,
    notebookPath?: string,
    options?: RuntimeOptions
  ): Promise<Runtime> {
    this.assertReady();

    // Check if runtime already exists
    const existingRuntime = this.notebookRuntimes.get(notebookId);
    if (existingRuntime) {
      return existingRuntime.runtime;
    }

    // Prevent race conditions - check if creation already in progress
    const existingPromise = this.runtimeCreationPromises.get(notebookId);
    if (existingPromise) {
      return existingPromise;
    }

    // Create and cache promise
    const creationPromise = this.createRuntimeInternal(
      notebookId,
      notebookPath,
      options
    );
    this.runtimeCreationPromises.set(notebookId, creationPromise);

    try {
      const runtime = await creationPromise;
      this.runtimeCreationPromises.delete(notebookId);
      return runtime;
    } catch (error) {
      this.runtimeCreationPromises.delete(notebookId);
      throw error;
    }
  }

  /**
   * Internal runtime creation method.
   */
  private async createRuntimeInternal(
    notebookId: string,
    notebookPath?: string,
    options?: RuntimeOptions
  ): Promise<Runtime> {
    try {
      this.logger.info(`Creating runtime for notebook ${notebookId}`, {
        notebookPath,
        options,
      });

      // Use SDK to create runtime
      const timestamp = Date.now().toString(36);
      const runtimeName =
        options?.name || `electron-${notebookId}-${timestamp}`;

      const environmentName = options?.environmentId || 'python-cpu-env';
      const runtimeType = 'notebook';
      const minutesLimit = 10;

      const result = await window.datalayerClient.createRuntime({
        environmentName,
        type: runtimeType,
        givenName: runtimeName,
        minutesLimit,
      });

      if (!result?.uid) {
        throw new Error('Failed to create runtime: No UID returned');
      }

      const runtime: Runtime = {
        uid: result.uid,
        givenName: runtimeName,
        podName: result.podName,
        ingress: result.ingress,
        token: result.token,
        environmentName: options?.environmentId || '',
        environmentTitle: result.environmentTitle || '',
        type: result.type || '',
        burningRate: result.burningRate || 0,
        startedAt: result.startedAt,
        expiredAt: result.expiredAt,
      };

      // Store runtime
      this.notebookRuntimes.set(notebookId, {
        notebookId,
        notebookPath,
        runtime,
      });

      // Start expiration timer if needed
      if (runtime.expiredAt) {
        this.startExpirationTimer(runtime);
      }

      // Notify listeners
      this.emitStateChange({
        notebookId,
        runtime,
        state: 'created',
      });

      this.logger.info(`Runtime created for notebook ${notebookId}`, {
        runtimeId: runtime.uid,
      });

      return runtime;
    } catch (error) {
      this.logger.error(
        `Failed to create runtime for notebook ${notebookId}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Terminate a runtime for a specific notebook.
   */
  async terminateRuntime(notebookId: string): Promise<void> {
    this.assertReady();

    const notebookRuntime = this.notebookRuntimes.get(notebookId);
    if (!notebookRuntime) {
      this.logger.warn(`No runtime found for notebook ${notebookId}`);
      return;
    }

    try {
      this.logger.info(`Terminating runtime for notebook ${notebookId}`, {
        runtimeId: notebookRuntime.runtime.uid,
      });

      // Clear expiration timer
      const timer = this.expirationTimers.get(notebookRuntime.runtime.uid);
      if (timer) {
        clearTimeout(timer);
        this.expirationTimers.delete(notebookRuntime.runtime.uid);
      }

      // Dispose service manager
      if (notebookRuntime.serviceManager) {
        notebookRuntime.serviceManager.dispose();
      }

      // Terminate via SDK
      await window.datalayerClient.deleteRuntime(notebookRuntime.runtime.uid);

      // Remove from map
      this.notebookRuntimes.delete(notebookId);

      // Notify listeners
      this.emitStateChange({
        notebookId,
        runtime: notebookRuntime.runtime,
        state: 'terminated',
      });

      this.logger.info(`Runtime terminated for notebook ${notebookId}`);
    } catch (error) {
      this.logger.error(
        `Failed to terminate runtime for notebook ${notebookId}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Get runtime for a notebook.
   */
  getRuntimeForNotebook(notebookId: string): Runtime | null {
    return this.notebookRuntimes.get(notebookId)?.runtime || null;
  }

  /**
   * Get service manager for a notebook.
   */
  getServiceManager(notebookId: string): ServiceManager.IManager | null {
    return this.notebookRuntimes.get(notebookId)?.serviceManager || null;
  }

  /**
   * Set service manager for a notebook.
   */
  setServiceManager(
    notebookId: string,
    manager: ServiceManager.IManager
  ): void {
    const notebookRuntime = this.notebookRuntimes.get(notebookId);
    if (notebookRuntime) {
      notebookRuntime.serviceManager = manager;
    } else {
      this.logger.warn(
        `Cannot set service manager: No runtime for notebook ${notebookId}`
      );
    }
  }

  /**
   * Subscribe to runtime state changes.
   */
  onRuntimeStateChanged(callback: RuntimeStateCallback): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Start expiration timer for runtime.
   */
  private startExpirationTimer(runtime: Runtime): void {
    if (!runtime.expiredAt) return;

    const expirationTime = new Date(runtime.expiredAt).getTime();
    const now = Date.now();
    const timeUntilExpiration = expirationTime - now;

    if (timeUntilExpiration <= 0) {
      this.handleRuntimeExpired(runtime.uid);
      return;
    }

    const timer = setTimeout(() => {
      this.handleRuntimeExpired(runtime.uid);
    }, timeUntilExpiration);

    this.expirationTimers.set(runtime.uid, timer);
  }

  /**
   * Handle runtime expiration.
   */
  private handleRuntimeExpired(runtimeUid: string): void {
    // Find notebook with this runtime
    for (const [notebookId, notebookRuntime] of this.notebookRuntimes) {
      if (notebookRuntime.runtime.uid === runtimeUid) {
        this.logger.warn(`Runtime expired for notebook ${notebookId}`, {
          runtimeId: runtimeUid,
        });

        // Emit state change
        this.emitStateChange({
          notebookId,
          runtime: notebookRuntime.runtime,
          state: 'expired',
        });

        // Clean up
        if (notebookRuntime.serviceManager) {
          notebookRuntime.serviceManager.dispose();
        }
        this.notebookRuntimes.delete(notebookId);
        this.expirationTimers.delete(runtimeUid);

        break;
      }
    }
  }

  /**
   * Clear all expiration timers.
   */
  private clearAllExpirationTimers(): void {
    for (const [, timer] of this.expirationTimers) {
      clearTimeout(timer);
    }
    this.expirationTimers.clear();
  }

  /**
   * Emit state change to all listeners.
   */
  private emitStateChange(change: RuntimeStateChange): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(change);
      } catch (error) {
        this.logger.error(
          'Error in runtime state change callback',
          error as Error
        );
      }
    }
  }

  /**
   * List all runtimes on the platform.
   * Uses cached data if available and fresh (< 30 seconds old).
   */
  async listAllRuntimes(): Promise<Runtime[]> {
    this.assertReady();

    const now = Date.now();
    const cacheAge = this.lastRuntimesFetch
      ? now - this.lastRuntimesFetch
      : Infinity;

    // Return cached data if fresh
    if (cacheAge < this.RUNTIME_CACHE_TTL && this.allRuntimes.length > 0) {
      this.logger.debug('Using cached runtime list', {
        count: this.allRuntimes.length,
        age: `${Math.floor(cacheAge / 1000)}s`,
      });
      return this.allRuntimes;
    }

    // Fetch fresh data
    return this.refreshAllRuntimes();
  }

  /**
   * Refresh the list of all platform runtimes.
   * Forces a fresh fetch even if cached data exists.
   */
  async refreshAllRuntimes(): Promise<Runtime[]> {
    this.assertReady();

    try {
      this.logger.debug('Fetching all platform runtimes...');

      // Fetch via IPC bridge (returns plain objects, not SDK models)
      const runtimes = await window.datalayerClient.listRuntimes();

      if (!Array.isArray(runtimes)) {
        throw new Error('Invalid runtimes response');
      }

      // RuntimeJSON is already in the correct format, just assign it
      this.allRuntimes = runtimes;

      this.lastRuntimesFetch = Date.now();

      this.logger.info(`Fetched ${this.allRuntimes.length} platform runtimes`);

      // Update global expiration timers for all runtimes
      this.updateGlobalExpirationTimers(runtimes);

      return this.allRuntimes;
    } catch (error) {
      this.logger.error('Failed to fetch platform runtimes', error as Error);
      throw error;
    }
  }

  /**
   * Subscribe to global runtime expiration events.
   * Called when ANY runtime on the platform expires.
   * @param callback - Function to call with the expired runtime's podName
   * @returns Unsubscribe function
   */
  onRuntimeExpired(callback: (podName: string) => void): () => void {
    this.globalExpirationCallbacks.add(callback);
    return () => {
      this.globalExpirationCallbacks.delete(callback);
    };
  }

  /**
   * Update global expiration timers for all platform runtimes.
   * This monitors ALL runtimes and notifies when they expire.
   */
  private updateGlobalExpirationTimers(runtimes: Runtime[]): void {
    // Clear existing timers
    for (const timer of this.globalExpirationTimers.values()) {
      clearTimeout(timer);
    }
    this.globalExpirationTimers.clear();

    // Set up new timers for each runtime
    for (const runtime of runtimes) {
      if (!runtime.expiredAt) continue;

      const expirationTime = new Date(runtime.expiredAt).getTime();
      const now = Date.now();
      const timeUntilExpiration = expirationTime - now;

      if (timeUntilExpiration <= 0) {
        // Already expired
        this.handleGlobalRuntimeExpired(runtime.podName);
        continue;
      }

      // Set timer for future expiration
      const timer = setTimeout(() => {
        this.handleGlobalRuntimeExpired(runtime.podName);
      }, timeUntilExpiration);

      this.globalExpirationTimers.set(runtime.podName, timer);

      this.logger.debug(`Set expiration timer for runtime ${runtime.podName}`, {
        expiresIn: Math.round(timeUntilExpiration / 1000),
      });
    }
  }

  /**
   * Handle global runtime expiration.
   * Notifies all subscribers that a runtime has expired.
   */
  private handleGlobalRuntimeExpired(podName: string): void {
    this.logger.warn(`Runtime ${podName} has expired globally`);

    // Remove from global timers
    this.globalExpirationTimers.delete(podName);

    // Remove from allRuntimes cache
    this.allRuntimes = this.allRuntimes.filter(r => r.podName !== podName);

    // Notify all subscribers
    for (const callback of this.globalExpirationCallbacks) {
      try {
        callback(podName);
      } catch (error) {
        this.logger.error(
          'Error in runtime expiration callback',
          error as Error
        );
      }
    }
  }
}
