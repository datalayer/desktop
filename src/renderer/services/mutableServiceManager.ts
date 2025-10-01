/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * ServiceManager wrapper that allows changing the underlying manager without React re-renders.
 * Keeps wrapper object stable while swapping internal service manager.
 *
 * @module renderer/services/mutableServiceManager
 */

import type { ServiceManager } from '@jupyterlab/services';
import { createMockServiceManager } from './mockServiceManager';
import { createProxyServiceManager } from './proxyServiceManager';

/**
 * Mutable service manager wrapper that maintains a stable reference
 * while allowing the underlying service manager to be swapped.
 */
export class MutableServiceManager {
  private _serviceManager: ServiceManager.IManager;
  private _listeners: Array<() => void> = [];
  private _proxy: ServiceManager.IManager;

  constructor(initialServiceManager?: ServiceManager.IManager) {
    this._serviceManager = initialServiceManager || createMockServiceManager();
    this._proxy = this.createProxyInternal();
  }

  /**
   * Get the proxy that forwards to the current service manager.
   * This maintains a stable reference across service manager swaps.
   */
  get proxy(): ServiceManager.IManager {
    return this._proxy;
  }

  /**
   * Update the service manager with new runtime connection settings.
   * This swaps the internal service manager without changing the proxy reference.
   *
   * @param ingress - The runtime ingress URL
   * @param token - The authentication token
   * @param runtimeId - The runtime ID
   */
  async updateConnection(
    ingress: string,
    token: string,
    runtimeId: string
  ): Promise<void> {
    // Dispose the old service manager if it's not mock
    if (
      this._serviceManager &&
      !(this._serviceManager as any).__isMockServiceManager &&
      typeof (this._serviceManager as any).dispose === 'function'
    ) {
      try {
        setTimeout(() => {
          try {
            (this._serviceManager as any).dispose();
          } catch (error) {
            console.warn(
              '[MutableServiceManager] Error disposing old service manager:',
              error
            );
          }
        }, 50);
      } catch (error) {
        // Continue with connection update anyway
      }
    }

    // Create new proxy service manager with new settings
    this._serviceManager = await createProxyServiceManager(
      ingress,
      token,
      runtimeId
    );

    // Notify listeners that the service manager has changed
    this._listeners.forEach(listener => listener());
  }

  /**
   * Reset to mock service manager.
   */
  resetToMock(): void {
    // Check if we're already using mock - if so, no need to change
    const currentIsMock = (this._serviceManager as any).__isMockServiceManager;
    if (currentIsMock) {
      return;
    }

    // Dispose the old service manager if it's not mock
    if (
      this._serviceManager &&
      typeof (this._serviceManager as any).dispose === 'function'
    ) {
      try {
        setTimeout(() => {
          try {
            (this._serviceManager as any).dispose();
          } catch (error) {
            console.warn(
              '[MutableServiceManager] Error disposing old service manager:',
              error
            );
          }
        }, 50);
      } catch (error) {
        // Continue with reset anyway
      }
    }

    this._serviceManager = createMockServiceManager();

    // Notify listeners
    this._listeners.forEach(listener => listener());
  }

  /**
   * Add a listener for service manager changes.
   *
   * @param listener - Callback to invoke when service manager changes
   * @returns Disposable to remove the listener
   */
  onChange(listener: () => void): { dispose: () => void } {
    this._listeners.push(listener);
    return {
      dispose: () => {
        const index = this._listeners.indexOf(listener);
        if (index >= 0) {
          this._listeners.splice(index, 1);
        }
      },
    };
  }

  /**
   * Create a proxy that forwards all property access to the current service manager.
   * This allows the MutableServiceManager to be used as a drop-in replacement.
   */
  private createProxyInternal(): ServiceManager.IManager {
    return new Proxy({} as ServiceManager.IManager, {
      get: (_target, prop) => {
        const current = this._serviceManager;
        return (current as any)[prop];
      },
      set: (_target, prop, value) => {
        const current = this._serviceManager;
        (current as any)[prop] = value;
        return true;
      },
      has: (_target, prop) => {
        const current = this._serviceManager;
        return prop in current;
      },
      ownKeys: _target => {
        const current = this._serviceManager;
        return Object.keys(current);
      },
      getOwnPropertyDescriptor: (_target, prop) => {
        const current = this._serviceManager;
        return Object.getOwnPropertyDescriptor(current, prop);
      },
    });
  }
}
