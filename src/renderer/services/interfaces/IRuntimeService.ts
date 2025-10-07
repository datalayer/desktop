/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

import { ServiceManager } from '@jupyterlab/services';
import { RuntimeJSON } from '@datalayer/core/lib/client/models';
import { ILifecycle } from './ILifecycle';

/**
 * Runtime information from Datalayer API.
 * Using RuntimeJSON from core library for consistent camelCase properties.
 */
export type Runtime = RuntimeJSON;

/**
 * Runtime creation options.
 */
export interface RuntimeOptions {
  environmentId?: string;
  name?: string;
  resources?: {
    cpu?: string;
    memory?: string;
  };
}

/**
 * Runtime state change event.
 */
export interface RuntimeStateChange {
  notebookId: string;
  runtime: Runtime;
  state: 'created' | 'terminated' | 'expired';
}

/**
 * Runtime service interface.
 * Manages compute runtime lifecycle for notebooks.
 */
export interface IRuntimeService extends ILifecycle {
  /**
   * Create a runtime for a specific notebook.
   */
  createRuntime(
    notebookId: string,
    notebookPath?: string,
    options?: RuntimeOptions
  ): Promise<Runtime>;

  /**
   * Terminate a runtime for a specific notebook.
   */
  terminateRuntime(notebookId: string): Promise<void>;

  /**
   * Get runtime for a notebook.
   */
  getRuntimeForNotebook(notebookId: string): Runtime | null;

  /**
   * Get service manager for a notebook.
   */
  getServiceManager(notebookId: string): ServiceManager.IManager | null;

  /**
   * Set service manager for a notebook.
   */
  setServiceManager(notebookId: string, manager: ServiceManager.IManager): void;

  /**
   * Subscribe to runtime state changes.
   */
  onRuntimeStateChanged(
    callback: (change: RuntimeStateChange) => void
  ): () => void;

  /**
   * List all runtimes on the platform (not just notebook-specific ones).
   * Used for runtime selection/browsing.
   */
  listAllRuntimes(): Promise<Runtime[]>;

  /**
   * Refresh the list of all platform runtimes.
   * Forces a fresh fetch even if cached.
   */
  refreshAllRuntimes(): Promise<Runtime[]>;

  /**
   * Subscribe to global runtime expiration events.
   * Called when ANY runtime on the platform expires.
   * @param callback - Function to call with the expired runtime's podName
   * @returns Unsubscribe function
   */
  onRuntimeExpired(callback: (podName: string) => void): () => void;

  /**
   * Manually notify all subscribers that a runtime has been terminated.
   * This propagates the termination to ALL editors connected to that runtime.
   * @param podName - The pod name of the terminated runtime
   */
  notifyRuntimeTerminated(podName: string): void;

  /**
   * Subscribe to runtime list refresh events.
   * Called when the list of all runtimes has been updated.
   * @param callback - Function to call with the updated runtime list
   * @returns Unsubscribe function
   */
  onRuntimeListRefreshed(callback: (runtimes: Runtime[]) => void): () => void;
}
