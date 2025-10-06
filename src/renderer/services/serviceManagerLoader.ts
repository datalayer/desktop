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
 * Vite module wrapper interface with __require for CommonJS interop.
 */
interface ViteModuleWrapper {
  ServiceManager?: unknown;
  ServerConnection?: unknown;
  default?: {
    ServiceManager?: unknown;
    ServerConnection?: unknown;
  } & unknown;
  __require?: (path: string) => unknown;
  [key: string]: unknown;
}

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
    const managerWrapper = managerModule as ViteModuleWrapper;
    let ServiceManager =
      (managerWrapper.ServiceManager as
        | typeof import('@jupyterlab/services').ServiceManager
        | undefined) ||
      ((managerWrapper.default as ViteModuleWrapper['default'])
        ?.ServiceManager as
        | typeof import('@jupyterlab/services').ServiceManager
        | undefined) ||
      (managerWrapper.default as
        | typeof import('@jupyterlab/services').ServiceManager
        | undefined);

    const serverConnectionWrapper = serverConnectionModule as ViteModuleWrapper;
    let ServerConnection =
      (serverConnectionWrapper.ServerConnection as typeof import('@jupyterlab/services').ServerConnection) ||
      ((serverConnectionWrapper.default as Record<string, unknown>)
        ?.ServerConnection as typeof import('@jupyterlab/services').ServerConnection) ||
      (serverConnectionWrapper.default as typeof import('@jupyterlab/services').ServerConnection);

    // Handle Vite's __require wrapper (CommonJS interop)
    // This is necessary for production builds with Vite's module wrapping
    const managerModuleAny = managerWrapper;
    if (
      !ServiceManager &&
      managerModuleAny.__require &&
      typeof managerModuleAny.__require === 'function'
    ) {
      console.log('[ServiceManagerLoader] Found __require wrapper, calling it');
      try {
        const unwrapped = managerModuleAny.__require(
          '@jupyterlab/services/lib/manager'
        ) as Record<string, unknown>;
        ServiceManager =
          (unwrapped?.ServiceManager as typeof import('@jupyterlab/services').ServiceManager) ||
          ((unwrapped?.default as Record<string, unknown>)
            ?.ServiceManager as typeof import('@jupyterlab/services').ServiceManager) ||
          (unwrapped?.default as typeof import('@jupyterlab/services').ServiceManager) ||
          (unwrapped as unknown as typeof import('@jupyterlab/services').ServiceManager);
      } catch (e) {
        console.error('[ServiceManagerLoader] Failed to use __require:', e);
      }
    }

    const serverConnectionModuleAny = serverConnectionWrapper;
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
        ) as Record<string, unknown>;
        ServerConnection =
          (unwrapped?.ServerConnection as typeof import('@jupyterlab/services').ServerConnection) ||
          ((unwrapped?.default as Record<string, unknown>)
            ?.ServerConnection as typeof import('@jupyterlab/services').ServerConnection) ||
          (unwrapped?.default as typeof import('@jupyterlab/services').ServerConnection) ||
          (unwrapped as typeof import('@jupyterlab/services').ServerConnection);
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
    if (!(ServerConnection as Record<string, unknown>).makeSettings) {
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
