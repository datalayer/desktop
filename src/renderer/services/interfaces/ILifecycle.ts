/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Service lifecycle states.
 */
export enum ServiceState {
  Uninitialized = 'uninitialized',
  Initializing = 'initializing',
  Ready = 'ready',
  Disposing = 'disposing',
  Disposed = 'disposed',
  Error = 'error',
}

/**
 * Lifecycle interface for services.
 * All services should implement this interface for consistent initialization and cleanup.
 */
export interface ILifecycle {
  /**
   * Current state of the service.
   */
  readonly state: ServiceState;

  /**
   * Initializes the service.
   * Should be called before any other service methods.
   */
  initialize(): Promise<void>;

  /**
   * Disposes the service and cleans up resources.
   * Should be called during application shutdown.
   */
  dispose(): Promise<void>;
}
