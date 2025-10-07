/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Main process entry point for the Datalayer Desktop Electron application.
 * Coordinates initialization of all application components and services.
 *
 * @module main/index
 */

import { initializeLogging, setupConsoleOverrides } from './config/logging';
import log from 'electron-log/main';

initializeLogging();
setupConsoleOverrides();

// Core Electron imports
import { app, ipcMain, shell } from 'electron';
import { getMainWindow } from './app/window-manager';

// Application components
import { Application } from './app/application';

// Services
import { sdkBridge } from './services/datalayer-sdk-bridge';
import { websocketProxy } from './services/websocket-proxy';
import { LoroWebSocketAdapter } from './services/loro-websocket-adapter';

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
  body?: unknown;
}

interface WebSocketConfig {
  url: string;
  protocol?: string;
  headers?: Record<string, string>;
  runtimeId?: string;
}

/**
 * Register all IPC handlers for the application.
 * Configures handlers for authentication, environments, runtimes, notebooks, and collaboration.
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

  interface AuthState {
    isAuthenticated: boolean;
    user: unknown;
    token: string | null;
    runUrl: string;
  }

  /**
   * Broadcast authentication state changes to renderer process.
   * @param authState - Authentication state to broadcast
   */
  function broadcastAuthState(authState: AuthState) {
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

    const authState: AuthState = {
      isAuthenticated: true,
      user: user,
      token: config.token || null,
      runUrl: config.iamRunUrl || '',
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
      'createRuntime',
      options.environmentName, // environmentName
      options.type, // type: 'notebook' | 'terminal' | 'job'
      options.givenName, // givenName
      options.minutesLimit, // minutesLimit
      undefined // fromSnapshotId
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
    const allNotebooks: unknown[] = [];

    if (Array.isArray(spaces)) {
      for (const space of spaces) {
        try {
          if (space && typeof space === 'object' && 'id' in space) {
            const items = await sdkBridge.call('get_space_items', space.id);
            if (Array.isArray(items)) {
              const notebooks = items.filter(
                (item): item is Record<string, unknown> =>
                  typeof item === 'object' &&
                  item !== null &&
                  'type' in item &&
                  item.type === 'notebook'
              );
              allNotebooks.push(...notebooks);
            }
          }
        } catch (error) {
          // Continue with other spaces if one fails
        }
      }
    }

    return allNotebooks; // Returns NotebookJSON[] directly
  });

  ipcMain.handle(
    'datalayer:create-notebook',
    async (_, { spaceId, name, description }) => {
      const notebook = await sdkBridge.call(
        'createNotebook',
        spaceId,
        name,
        description
      );
      return notebook; // Returns NotebookJSON directly, throws on error
    }
  );

  ipcMain.handle(
    'datalayer:create-lexical',
    async (_, { spaceId, name, description }) => {
      const lexical = await sdkBridge.call(
        'createLexical',
        spaceId,
        name,
        description
      );
      return lexical; // Returns LexicalJSON directly, throws on error
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

  ipcMain.handle('datalayer:get-content', async (_, itemId: string) => {
    const content = await sdkBridge.call('getContent', itemId);
    return content; // Returns item content from CDN or API, throws on error
  });

  // Note: create-notebook and create-lexical handlers are already registered above

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

  // Configuration handlers
  ipcMain.handle('datalayer:get-spacer-run-url', async () => {
    const config = sdkBridge.getConfig();
    return config.spacerRunUrl;
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
        requestOptions.body = body as BodyInit;
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
    if (!global.__datalayerRuntimeCleanup) {
      global.__datalayerRuntimeCleanup = new Map();
    }

    const cleanupRegistry = global.__datalayerRuntimeCleanup;
    cleanupRegistry.set(runtimeId, { terminated: true });

    // Close all WebSocket connections for this runtime
    try {
      websocketProxy.closeConnectionsForRuntime(runtimeId);
    } catch (error) {
      // Error closing WebSocket connections
    }

    return { success: true };
  });

  // Loro collaboration handlers
  const loroAdapters = new Map<string, LoroWebSocketAdapter>();

  ipcMain.handle(
    'loro:connect',
    async (
      _,
      {
        adapterId,
        websocketUrl,
        token,
      }: { adapterId: string; websocketUrl: string; token?: string }
    ) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('Main window not available');
      }

      // Check if adapter already exists
      let adapter = loroAdapters.get(adapterId);
      if (adapter) {
        // Adapter already exists, check if connected
        if (adapter.isConnected()) {
          return { success: true, status: 'already-connected' };
        } else {
          // Dispose old adapter and create new one
          adapter.dispose();
        }
      }

      // Create new adapter with auth token
      adapter = new LoroWebSocketAdapter(
        adapterId,
        websocketUrl,
        mainWindow,
        token
      );
      loroAdapters.set(adapterId, adapter);
      adapter.connect();

      log.debug(`[Loro] Created adapter ${adapterId} for ${websocketUrl}`);
      return { success: true, status: 'connecting' };
    }
  );

  ipcMain.handle(
    'loro:disconnect',
    async (_, { adapterId }: { adapterId: string }) => {
      const adapter = loroAdapters.get(adapterId);
      if (adapter) {
        adapter.dispose();
        loroAdapters.delete(adapterId);
        log.debug(`[Loro] Disposed adapter ${adapterId}`);
      }
      return { success: true };
    }
  );

  ipcMain.handle(
    'loro:send-message',
    async (_, { adapterId, data }: { adapterId: string; data: unknown }) => {
      const adapter = loroAdapters.get(adapterId);
      if (!adapter) {
        throw new Error(`Loro adapter ${adapterId} not found`);
      }

      adapter.send(data);
      return { success: true };
    }
  );

  // Clean up adapters when window is closed
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.on('close', () => {
      loroAdapters.forEach(adapter => adapter.dispose());
      loroAdapters.clear();
      log.debug('[Loro] Cleaned up all adapters on window close');
    });
  }
}

/**
 * Main application initialization.
 * Initializes SDK bridge, registers IPC handlers, and starts the application.
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
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
main();
