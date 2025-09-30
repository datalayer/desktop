/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/index
 *
 * Clean main process entry point for the Datalayer Desktop Electron application.
 * Coordinates initialization of all application components and services.
 *
 * Architecture:
 * - Logging configuration and console overrides
 * - Application lifecycle management
 * - IPC handler registration
 * - Service initialization
 */

// Initialize logging FIRST
import { initializeLogging, setupConsoleOverrides } from './config/logging';
import log from 'electron-log/main';

// Initialize logging immediately
initializeLogging();
setupConsoleOverrides();

// Core Electron imports
import * as electron from 'electron';
const { app, ipcMain, shell } = electron;
import { getMainWindow } from './app/window-manager';

// Application components
import { Application } from './app/application';

// Services
import { sdkBridge } from './services/datalayer-sdk-bridge';
import { websocketProxy } from './services/websocket-proxy';

// Type definitions
interface VersionInfo {
  electron: string;
  node: string;
  chrome: string;
  app: string;
}

interface EnvironmentVars {
  DATALAYER_RUN_URL: string;
  DATALAYER_TOKEN: string;
}

interface HTTPRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

interface WebSocketConfig {
  url: string;
  protocol?: string;
  headers?: Record<string, string>;
  runtimeId?: string;
}

/**
 * Register all IPC handlers for the application
 */
function registerIPCHandlers(): void {
  // System handlers
  ipcMain.on('open-external', (_, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('get-version', (): VersionInfo => {
    const { app } = require('electron');
    return {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      app: app.getVersion(),
    };
  });

  ipcMain.handle('get-env', (): EnvironmentVars => {
    return {
      DATALAYER_RUN_URL: process.env.DATALAYER_RUN_URL || '',
      DATALAYER_TOKEN: process.env.DATALAYER_TOKEN || '',
    };
  });

  // Auth state broadcasting utility
  function broadcastAuthState(authState: any) {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth-state-changed', authState);
      log.debug('[Auth] Broadcasted auth state change:', {
        isAuthenticated: authState.isAuthenticated,
        hasUser: !!authState.user,
      });
    }
  }

  // Authentication handlers - using SDK bridge
  ipcMain.handle('datalayer:login', async (_, { token }) => {
    await sdkBridge.call('login', token);

    // Fetch user data and broadcast auth state change
    const user = await sdkBridge.call('whoami');
    const config = sdkBridge.getConfig();

    const authState = {
      isAuthenticated: true,
      user: user,
      token: config.token,
      runUrl: config.iamRunUrl,
    };

    broadcastAuthState(authState);

    // Return auth state for immediate use in renderer
    return authState;
  });

  ipcMain.handle('datalayer:logout', async () => {
    try {
      await sdkBridge.call('logout');
    } catch (error) {
      // Don't fail logout - silently ignore errors
    }

    // Broadcast logged out state
    const authState = {
      isAuthenticated: false,
      user: null,
      token: null,
      runUrl: '',
    };

    broadcastAuthState(authState);

    return authState;
  });

  // New method to get current auth state (includes user data)
  ipcMain.handle('datalayer:get-auth-state', async () => {
    // Use the SDK bridge's getAuthState which checks stored tokens
    return sdkBridge.getAuthState();
  });

  // Legacy credentials method (for backward compatibility)
  ipcMain.handle('datalayer:get-credentials', async () => {
    try {
      const config = sdkBridge.getConfig();
      return {
        runUrl: config.iamRunUrl,
        token: config.token,
        isAuthenticated: !!config.token,
      };
    } catch (error) {
      return { runUrl: '', token: '', isAuthenticated: false };
    }
  });

  // Environment and runtime handlers - using SDK bridge
  ipcMain.handle('datalayer:list-environments', async () => {
    const environments = await sdkBridge.call('list_environments');
    return environments; // Returns EnvironmentJSON[] directly, throws on error
  });

  ipcMain.handle('datalayer:create-runtime', async (_, options) => {
    const runtime = await sdkBridge.call(
      'ensure_runtime',
      options.environment,
      options.credits || 100,
      true, // waitForReady
      120000, // maxWaitTime
      true // reuseExisting
    );
    return runtime; // Returns RuntimeJSON directly, throws on error
  });

  ipcMain.handle('datalayer:delete-runtime', async (_, podName) => {
    await sdkBridge.call('delete_runtime', podName);
    // Returns void on success, throws on error
  });

  ipcMain.handle('datalayer:get-runtime', async (_, runtimeId) => {
    const runtime = await sdkBridge.call('get_runtime', runtimeId);
    return runtime; // Returns RuntimeJSON directly, throws on error
  });

  ipcMain.handle('datalayer:is-runtime-active', async (_, podName) => {
    try {
      const runtime = await sdkBridge.call('get_runtime', podName);
      // Check if runtime is ready
      return { isActive: !!runtime, runtime };
    } catch (error) {
      // If we can't get the runtime, it's not active
      return { isActive: false };
    }
  });

  ipcMain.handle('datalayer:list-runtimes', async () => {
    const runtimes = await sdkBridge.call('list_runtimes');
    return runtimes; // Returns RuntimeJSON[] directly, throws on error
  });

  // Notebook and document handlers - using SDK bridge
  ipcMain.handle('datalayer:list-notebooks', async () => {
    // Get all spaces and their items
    const spaces = await sdkBridge.call('get_my_spaces');
    const allNotebooks: any[] = [];

    for (const space of spaces || []) {
      try {
        const items = await sdkBridge.call('get_space_items', space.id);
        const notebooks =
          items?.filter((item: any) => item.type === 'notebook') || [];
        allNotebooks.push(...notebooks);
      } catch (error) {
        // Continue with other spaces if one fails
      }
    }

    return allNotebooks; // Returns NotebookJSON[] directly
  });

  ipcMain.handle(
    'datalayer:create-notebook',
    async (_, { spaceId, name, description }) => {
      const notebook = await sdkBridge.call(
        'create_notebook',
        spaceId,
        name,
        description
      );
      return notebook; // Returns NotebookJSON directly, throws on error
    }
  );

  ipcMain.handle('datalayer:delete-space-item', async (_, { itemId }) => {
    await sdkBridge.call('delete_space_item', itemId);
    // Returns void on success, throws on error
  });

  // Space handlers - using SDK bridge
  ipcMain.handle('datalayer:get-my-spaces', async () => {
    const spaces = await sdkBridge.call('get_my_spaces');
    return spaces; // Returns SpaceJSON[] directly, throws on error
  });

  ipcMain.handle('datalayer:get-space-items', async (_, spaceId: string) => {
    const items = await sdkBridge.call('get_space_items', spaceId);
    return items; // Returns Array<NotebookJSON | LexicalJSON> directly, throws on error
  });

  // Collaboration handlers
  ipcMain.handle(
    'datalayer:get-collaboration-session',
    async (_, documentId) => {
      try {
        // Use the SDK bridge to get collaboration session ID
        const sessionId = await sdkBridge.call(
          'getCollaborationSessionId',
          documentId
        );
        return sessionId;
      } catch (error) {
        log.error('Failed to get collaboration session ID:', error);
        // Fallback to document ID
        return documentId;
      }
    }
  );

  ipcMain.handle('datalayer:get-collaboration-token', async () => {
    // Use SDK bridge to get current auth state
    const authState = sdkBridge.getAuthState();
    return {
      runUrl: authState.runUrl,
      token: authState.token,
      isAuthenticated: authState.isAuthenticated,
    };
  });

  // User handlers - using SDK bridge
  ipcMain.handle('datalayer:whoami', async () => {
    const user = await sdkBridge.call('whoami');
    return user; // Returns User directly, throws on error
  });

  // GitHub user handler removed - use whoami instead
  // Generic request handler removed - use specific SDK methods instead

  // HTTP proxy handlers
  ipcMain.handle('proxy:http-request', async (_, config: HTTPRequestConfig) => {
    const { url, method, headers, body } = config;

    const requestOptions: RequestInit = {
      method: method || 'GET',
      headers: headers || {},
    };

    // Add body if present and method supports it
    if (body && !['GET', 'HEAD'].includes(method || 'GET')) {
      if (body instanceof ArrayBuffer) {
        requestOptions.body = Buffer.from(new Uint8Array(body));
      } else if (body instanceof Uint8Array) {
        requestOptions.body = Buffer.from(body);
      } else if (typeof body === 'object') {
        requestOptions.body = JSON.stringify(body);
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json',
        };
      } else {
        requestOptions.body = body;
      }
    }

    const response = await fetch(url, requestOptions);

    // Get response headers as plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Get response body
    let responseBody: unknown;
    const contentType = response.headers.get('content-type');

    if (!method || method === 'DELETE') {
      responseBody = undefined;
    } else if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType?.includes('text')) {
      responseBody = await response.text();
    } else {
      const buffer = await response.arrayBuffer();
      responseBody = Array.from(new Uint8Array(buffer));
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };
  });

  // WebSocket proxy handlers
  ipcMain.handle('proxy:websocket-open', async (_, config: WebSocketConfig) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      throw new Error('Main window not available');
    }

    const { url, protocol, headers, runtimeId } = config;
    const result = websocketProxy.open(
      mainWindow,
      url,
      protocol,
      headers,
      runtimeId
    );

    // Check if the connection was blocked
    if ('blocked' in result && result.blocked) {
      throw new Error(result.reason);
    }

    return result;
  });

  ipcMain.handle('proxy:websocket-send', async (_, { id, data }) => {
    websocketProxy.send(id, data);
    return { success: true };
  });

  ipcMain.handle('proxy:websocket-close', async (_, { id, code, reason }) => {
    websocketProxy.close(id, code, reason);
    return { success: true };
  });

  ipcMain.handle('proxy:websocket-close-runtime', async (_, { runtimeId }) => {
    websocketProxy.closeConnectionsForRuntime(runtimeId);
    return { success: true };
  });

  // Runtime termination notification handler
  ipcMain.handle('runtime-terminated', async (_, { runtimeId }) => {
    // Initialize global cleanup registry in main process
    if (!(global as any).__datalayerRuntimeCleanup) {
      (global as any).__datalayerRuntimeCleanup = new Map();
    }

    const cleanupRegistry = (global as any).__datalayerRuntimeCleanup;
    cleanupRegistry.set(runtimeId, { terminated: true });

    // Close all WebSocket connections for this runtime
    try {
      websocketProxy.closeConnectionsForRuntime(runtimeId);
    } catch (error) {
      // Error closing WebSocket connections
    }

    return { success: true };
  });
}

/**
 * Main application initialization
 */
async function main(): Promise<void> {
  try {
    // Wait for app to be ready first
    await app.whenReady();

    // Initialize SDK bridge AFTER app is ready
    await sdkBridge.initialize();

    // Register all IPC handlers
    registerIPCHandlers();

    // Set up application event handlers
    Application.setupEventHandlers();

    // Initialize the application
    await Application.initialize();

    // Check for stored authentication and broadcast if authenticated
    const authState = sdkBridge.getAuthState();
    if (authState.isAuthenticated) {
      log.info(
        '[Main] Found stored authentication, broadcasting to renderer...'
      );
      // Wait a bit for the renderer to be ready
      setTimeout(() => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-state-changed', authState);
          log.info('[Main] Broadcasted stored auth state to renderer');
        }
      }, 2000); // Wait 2 seconds for renderer to be fully ready
    }

    console.log('Datalayer Desktop application started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
main();
