/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

import { ServiceManager } from '@jupyterlab/services';
import { ILifecycle } from './ILifecycle';

/**
 * Runtime information from Datalayer API.
 */
export interface Runtime {
  uid: string;
  given_name?: string;
  pod_name: string;
  ingress?: string;
  token?: string;
  environment_name?: string;
  environment_title?: string;
  type?: string;
  burning_rate?: number;
  reservation_id?: string;
  started_at?: string;
  expired_at?: string;
  status?: string;
  [key: string]: unknown;
}

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
  onRuntimeStateChanged(callback: (change: RuntimeStateChange) => void): () => void;
}
