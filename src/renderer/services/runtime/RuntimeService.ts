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
import { DatalayerClient, RuntimeJSON } from '@datalayer/core/lib/client';
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
        given_name: runtimeName,
        pod_name: result.podName,
        ingress: result.ingress,
        token: result.token,
        environment_name: options?.environmentId,
        status: 'running',
        started_at: result.startedAt,
        expired_at: result.expiredAt,
      };

      // Store runtime
      this.notebookRuntimes.set(notebookId, {
        notebookId,
        notebookPath,
        runtime,
      });

      // Start expiration timer if needed
      if (runtime.expired_at) {
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
    if (!runtime.expired_at) return;

    const expirationTime = parseInt(runtime.expired_at, 10) * 1000;
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

      // Map to Runtime interface
      this.allRuntimes = runtimes.map((r: RuntimeJSON) => ({
        uid: r.uid,
        given_name: r.givenName,
        pod_name: r.podName,
        ingress: r.ingress,
        token: r.token,
        environment_name: r.environmentName,
        environment_title: r.environmentTitle,
        type: r.type,
        burning_rate: r.burningRate,
        reservation_id: '', // Not in RuntimeJSON, use empty string
        started_at: r.startedAt,
        expired_at: r.expiredAt,
        status: 'running', // Not in RuntimeJSON, assume running
      }));

      this.lastRuntimesFetch = Date.now();

      this.logger.info(`Fetched ${this.allRuntimes.length} platform runtimes`);
      return this.allRuntimes;
    } catch (error) {
      this.logger.error('Failed to fetch platform runtimes', error as Error);
      throw error;
    }
  }
}
