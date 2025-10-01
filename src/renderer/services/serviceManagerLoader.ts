/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Runtime loader for ServiceManager handling CommonJS/ESM module resolution.
 * Provides dynamic loading of JupyterLab services to work around bundling conflicts.
 *
 * @module renderer/services/serviceManagerLoader
 */

let realServiceManager: any = null;
let realServerConnection: any = null;

/**
 * Dynamically load the real ServiceManager at runtime.
 * Caches the loaded module for subsequent calls.
 *
 * @returns Promise resolving to ServiceManager and ServerConnection classes
 * @throws {Error} If ServiceManager cannot be loaded from the module
 */
export async function loadServiceManager() {
  if (realServiceManager) {
    // Using cached ServiceManager
    return {
      ServiceManager: realServiceManager,
      ServerConnection: realServerConnection,
    };
  }

  // Loading @jupyterlab/services dynamically...

  // Import the proxy file instead which has the proper exports
  // @ts-expect-error Dynamic import of JS file - types not available
  const services = await import('../polyfills/jupyterlab-proxy.js');
  // Loaded jupyterlab-services-proxy

  // Extract ServiceManager and ServerConnection
  realServiceManager = services?.ServiceManager;
  realServerConnection = services?.ServerConnection;

  if (!realServiceManager) {
    // ServiceManager not found in services

    // Check if it's wrapped in default or another property
    if (services?.default) {
      // Checking default export...
      realServiceManager = services.default?.ServiceManager;
      realServerConnection = services.default?.ServerConnection;
    }

    if (!realServiceManager) {
      throw new Error(
        'Failed to import ServiceManager from @jupyterlab/services'
      );
    }
  }

  // Successfully loaded ServiceManager and ServerConnection

  return {
    ServiceManager: realServiceManager,
    ServerConnection: realServerConnection,
  };
}

/**
 * Create a service manager instance using the dynamically loaded class.
 *
 * @param options - Optional configuration options for ServiceManager
 * @returns Promise resolving to a new ServiceManager instance
 * @throws {Error} If ServiceManager could not be loaded
 */
export async function createServiceManager(options?: any) {
  const { ServiceManager } = await loadServiceManager();
  if (!ServiceManager) {
    throw new Error('ServiceManager could not be loaded');
  }
  return new ServiceManager(options);
}
