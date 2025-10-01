/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Dynamic loader for JupyterLab ServiceManager.
 * Imports from the proxied @jupyterlab/services module.
 *
 * @module renderer/services/serviceManagerLoader
 */

/**
 * Load ServiceManager and ServerConnection from @jupyterlab/services.
 * This function exists to allow dynamic imports and proper module resolution
 * through the Vite proxy configuration.
 *
 * @returns Object containing ServiceManager and ServerConnection classes
 */
export async function loadServiceManager() {
  try {
    // Import directly from lib paths to avoid bundling issues
    // In production, Vite bundles the main @jupyterlab/services module incorrectly
    const [managerModule, serverConnectionModule] = await Promise.all([
      import('@jupyterlab/services/lib/manager'),
      import('@jupyterlab/services/lib/serverconnection'),
    ]);

    // Extract the exports (handle both CJS and ESM)
    let ServiceManager = (managerModule as any).ServiceManager || (managerModule as any).default?.ServiceManager || (managerModule as any).default;
    let ServerConnection = (serverConnectionModule as any).ServerConnection || (serverConnectionModule as any).default?.ServerConnection || (serverConnectionModule as any).default;

    // Handle Vite's __require wrapper (CommonJS interop)
    if (!ServiceManager && (managerModule as any).__require && typeof (managerModule as any).__require === 'function') {
      console.log('[ServiceManagerLoader] Found __require wrapper, calling it');
      try {
        const unwrapped = (managerModule as any).__require('@jupyterlab/services/lib/manager');
        ServiceManager = unwrapped?.ServiceManager || unwrapped?.default?.ServiceManager || unwrapped?.default || unwrapped;
      } catch (e) {
        console.error('[ServiceManagerLoader] Failed to use __require:', e);
      }
    }

    if (!ServerConnection && (serverConnectionModule as any).__require && typeof (serverConnectionModule as any).__require === 'function') {
      console.log('[ServiceManagerLoader] Found __require wrapper for ServerConnection, calling it');
      try {
        const unwrapped = (serverConnectionModule as any).__require('@jupyterlab/services/lib/serverconnection');
        ServerConnection = unwrapped?.ServerConnection || unwrapped?.default?.ServerConnection || unwrapped?.default || unwrapped;
      } catch (e) {
        console.error('[ServiceManagerLoader] Failed to use __require for ServerConnection:', e);
      }
    }

    // Verify that required exports exist
    if (!ServiceManager) {
      console.error('[ServiceManagerLoader] Failed to extract ServiceManager from module:', {
        managerModuleKeys: Object.keys(managerModule),
        managerModuleDefault: (managerModule as any).default,
      });
      throw new Error('ServiceManager not found in @jupyterlab/services/lib/manager');
    }
    if (!ServerConnection) {
      console.error('[ServiceManagerLoader] Failed to extract ServerConnection from module:', {
        serverConnectionModuleKeys: Object.keys(serverConnectionModule),
        serverConnectionModuleDefault: (serverConnectionModule as any).default,
      });
      throw new Error('ServerConnection not found in @jupyterlab/services/lib/serverconnection');
    }
    if (!ServerConnection.makeSettings) {
      throw new Error('ServerConnection.makeSettings not found');
    }

    console.log('[ServiceManagerLoader] Successfully loaded ServiceManager and ServerConnection');
    return {
      ServiceManager,
      ServerConnection,
    };
  } catch (error) {
    console.error('[ServiceManagerLoader] Failed to load @jupyterlab/services:', error);
    throw error;
  }
}
