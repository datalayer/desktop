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
    // Vite's module interop requires dynamic property access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ServiceManager =
      (managerModule as any).ServiceManager ||
      (managerModule as any).default?.ServiceManager ||
      (managerModule as any).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ServerConnection =
      (serverConnectionModule as any).ServerConnection ||
      (serverConnectionModule as any).default?.ServerConnection ||
      (serverConnectionModule as any).default;

    // Handle Vite's __require wrapper (CommonJS interop)
    // This is necessary for production builds with Vite's module wrapping
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const managerModuleAny = managerModule as any;
    if (
      !ServiceManager &&
      managerModuleAny.__require &&
      typeof managerModuleAny.__require === 'function'
    ) {
      console.log('[ServiceManagerLoader] Found __require wrapper, calling it');
      try {
        const unwrapped = managerModuleAny.__require(
          '@jupyterlab/services/lib/manager'
        );
        ServiceManager =
          unwrapped?.ServiceManager ||
          unwrapped?.default?.ServiceManager ||
          unwrapped?.default ||
          unwrapped;
      } catch (e) {
        console.error('[ServiceManagerLoader] Failed to use __require:', e);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverConnectionModuleAny = serverConnectionModule as any;
    if (
      !ServerConnection &&
      serverConnectionModuleAny.__require &&
      typeof serverConnectionModuleAny.__require === 'function'
    ) {
      console.log(
        '[ServiceManagerLoader] Found __require wrapper for ServerConnection, calling it'
      );
      try {
        const unwrapped = serverConnectionModuleAny.__require(
          '@jupyterlab/services/lib/serverconnection'
        );
        ServerConnection =
          unwrapped?.ServerConnection ||
          unwrapped?.default?.ServerConnection ||
          unwrapped?.default ||
          unwrapped;
      } catch (e) {
        console.error(
          '[ServiceManagerLoader] Failed to use __require for ServerConnection:',
          e
        );
      }
    }

    // Verify that required exports exist
    if (!ServiceManager) {
      console.error(
        '[ServiceManagerLoader] Failed to extract ServiceManager from module:',
        {
          managerModuleKeys: Object.keys(managerModule),
          managerModuleDefault: managerModuleAny.default,
        }
      );
      throw new Error(
        'ServiceManager not found in @jupyterlab/services/lib/manager'
      );
    }
    if (!ServerConnection) {
      console.error(
        '[ServiceManagerLoader] Failed to extract ServerConnection from module:',
        {
          serverConnectionModuleKeys: Object.keys(serverConnectionModule),
          serverConnectionModuleDefault: serverConnectionModuleAny.default,
        }
      );
      throw new Error(
        'ServerConnection not found in @jupyterlab/services/lib/serverconnection'
      );
    }
    if (!ServerConnection.makeSettings) {
      throw new Error('ServerConnection.makeSettings not found');
    }

    console.log(
      '[ServiceManagerLoader] Successfully loaded ServiceManager and ServerConnection'
    );
    return {
      ServiceManager,
      ServerConnection,
    };
  } catch (error) {
    console.error(
      '[ServiceManagerLoader] Failed to load @jupyterlab/services:',
      error
    );
    throw error;
  }
}
