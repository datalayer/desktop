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
import { refreshMenu } from './app/menu-manager';
import { exchangePasswordForToken } from './services/password-login';

// The app's name, unpackaged as packaged (the menu's About, the user data
// folder); the suite runs the app with a user data folder of its own
// (DK-15) — both set before anything reads them.
app.setName('Datalayer Desktop');
if (process.env.DATALAYER_DESKTOP_USER_DATA) {
  app.setPath('userData', process.env.DATALAYER_DESKTOP_USER_DATA);
}

// Application components
import { Application } from './app/application';

// Services
import { sdkBridge } from './services/datalayer-sdk-bridge';
import { websocketProxy } from './services/websocket-proxy';
import { LoroWebSocketAdapter } from './services/loro-websocket-adapter';
import {
  appChatUserToken,
  forgetAppChats,
  lendTokenToAppChats,
  listAppChatDeployments,
} from './services/app-chat';
import {
  registerSessionsIpc,
  startSessionsServices,
} from './services/sessions-ipc';
import {
  SIGN_IN_CALLBACK,
  SIGN_IN_SENTENCES,
  signIn,
} from './services/sign-in';
import { closeSignInWindow, openSignInWindow } from './services/sign-in-window';
import { registerAppsIpc } from './services/apps';

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
    refreshMenu({ signedIn: authState.isAuthenticated });
  }

  /**
   * The sign-in callback the sign-in window caught (DK-03): the token kept
   * through the SDK bridge once the state matches, the person signed in;
   * otherwise the sentence goes to the Login page.
   * @param url - The `datalayer://auth…` URL
   */
  async function signInCallbackReceived(url: string): Promise<void> {
    const outcome = await signIn.callback(url, {
      keep: async token => {
        await sdkBridge.call('login', token);
      },
    });
    if (!outcome.ok) {
      log.warn(`[Sign-in] ${outcome.sentence}`);
      getMainWindow()?.webContents.send('sign-in:failed', outcome.sentence);
      return;
    }
    const user = await sdkBridge.call('whoami');
    const config = sdkBridge.getConfig();
    log.info(`[Sign-in] Signed in with ${outcome.provider}`);
    broadcastAuthState({
      isAuthenticated: true,
      user,
      token: config.token || null,
      runUrl: config.iamUrl || '',
    });
  }

  // Sign in with a provider (DK-03): IAM's page in a small window of its
  // own over the main window, closed once the callback comes back.
  ipcMain.handle('sign-in:start', async (_, { provider }) => {
    const { getOAuth2AuthzUrl } =
      await import('@datalayer/core/lib/api/iam/oauth2');
    const iamUrl = sdkBridge.getConfig().iamUrl || '';
    const started = await signIn.start(provider, {
      authorizationUrl: (chosen, callbackUri, nonce) =>
        getOAuth2AuthzUrl(chosen, callbackUri, nonce, iamUrl),
      load: url => {
        openSignInWindow(url, getMainWindow(), {
          onCallback: callback => {
            signInCallbackReceived(callback).catch(error => {
              log.error('[Sign-in] The callback failed:', error);
              getMainWindow()?.webContents.send(
                'sign-in:failed',
                SIGN_IN_SENTENCES.refused(
                  error instanceof Error ? error.message : String(error)
                )
              );
            });
          },
          onClosed: () => {
            if (!signIn.inFlight) {
              return;
            }
            signIn.cancel();
            log.info('[Sign-in] The sign-in window was closed');
            getMainWindow()?.webContents.send(
              'sign-in:failed',
              SIGN_IN_SENTENCES.windowClosed
            );
          },
        });
      },
    });
    if (started.ok) {
      log.info(
        `[Sign-in] ${provider} opened in the sign-in window, callback ${SIGN_IN_CALLBACK}`
      );
      return { ok: true };
    }
    log.warn(`[Sign-in] ${started.sentence}`);
    return { ok: false, sentence: started.sentence };
  });

  // Apps' reads and its one change (DK-02): the main process's token.
  registerAppsIpc();

  // The menu's entries follow what the renderer shows (DK-04).
  ipcMain.handle(
    'menu:state',
    async (_, state: { sessionInFront?: boolean }) => {
      refreshMenu({ sessionInFront: Boolean(state?.sessionInFront) });
    }
  );

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
      runUrl: config.iamUrl || '',
    };

    broadcastAuthState(authState);

    // Return auth state for immediate use in renderer
    return authState;
  });

  // A handle and password, exchanged with IAM for a token; the token then
  // signs in as a typed token does. The password is never kept.
  ipcMain.handle(
    'datalayer:login-password',
    async (_, { runUrl, handle, password }) => {
      const token = await exchangePasswordForToken({
        runUrl,
        handle,
        password,
      });
      await sdkBridge.call('login', token);
      const user = await sdkBridge.call('whoami');
      const config = sdkBridge.getConfig();
      const authState: AuthState = {
        isAuthenticated: true,
        user: user,
        token: config.token || null,
        runUrl: config.iamUrl || '',
      };
      broadcastAuthState(authState);
      return authState;
    }
  );

  ipcMain.handle('datalayer:logout', async () => {
    // Nothing of an application's chat is signed once signed out (A-20).
    forgetAppChats();
    // A sign-in in progress ends with the token (DK-03).
    signIn.cancel();
    closeSignInWindow();
    try {
      await sdkBridge.call('logout');
    } catch {
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
    // A stored token kept while IAM did not answer is checked again first.
    await sdkBridge.retryRestore();
    return sdkBridge.getAuthState();
  });

  // Environment and runtime handlers - using SDK bridge
  ipcMain.handle('datalayer:list-environments', async () => {
    // Access the SDK directly so we can preserve the raw `icon` and `resources`
    // fields, which the generic toJSON() serialization drops. This mirrors how
    // the UI (EnvironmentsPlatform) reads environments from the runtimes API.
    const sdk = sdkBridge.getSDK() as unknown as {
      listEnvironments: () => Promise<
        Array<{
          toJSON: () => Record<string, unknown>;
          rawData: () => Record<string, unknown>;
        }>
      >;
    };
    const environments = await sdk.listEnvironments();
    return environments.map(env => {
      const json = env.toJSON();
      const raw = env.rawData();
      return {
        ...json,
        icon: raw.icon,
        resources: raw.resources,
        language: raw.language,
        dockerImage: raw.dockerImage,
        tags: raw.tags,
      };
    });
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

  ipcMain.handle('datalayer:delete-runtime', async (_, runtimeName) => {
    await sdkBridge.call('delete_runtime', runtimeName);
    // Returns void on success, throws on error
  });

  ipcMain.handle('datalayer:terminate-all-runtimes', async () => {
    const results = await sdkBridge.call('terminate_all_runtimes');
    return results; // Returns PromiseSettledResult<void>[]
  });

  ipcMain.handle('datalayer:get-runtime', async (_, runtimeId) => {
    const runtime = await sdkBridge.call('get_runtime', runtimeId);
    return runtime; // Returns RuntimeJSON directly, throws on error
  });

  ipcMain.handle('datalayer:is-runtime-active', async (_, runtimeName) => {
    try {
      const runtime = await sdkBridge.call('get_runtime', runtimeName);
      // Check if runtime is ready
      return { isActive: !!runtime, runtime };
    } catch {
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
        } catch {
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
    'datalayer:update-notebook',
    async (_, { uid, name, description }) => {
      const notebook = await sdkBridge.call(
        'updateNotebook',
        uid,
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

  ipcMain.handle(
    'datalayer:update-lexical',
    async (_, { uid, name, description }) => {
      const lexical = await sdkBridge.call(
        'updateLexical',
        uid,
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

  // A deployed application's agent (APPS A-20): the person's deployments,
  // listed here with the token the main process holds; the runtimes they
  // are kept on are the only ones the session lends it to.
  ipcMain.handle('app-chat:list-deployments', async () =>
    listAppChatDeployments()
  );
  // A deployment that takes only a signed user (D-21): signed here, with
  // the token this process holds; only the user token goes back.
  ipcMain.handle('app-chat:user-token', async (_event, deploymentUid: string) =>
    appChatUserToken(deploymentUid)
  );

  // Configuration handlers
  ipcMain.handle('datalayer:get-spacer-run-url', async () => {
    const config = sdkBridge.getConfig();
    return config.spacerUrl;
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
    } catch {
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
    // The sessions' handlers: the local runtime, the two lists, the
    // approvals, the dialogs (DESKTOP §7's contract).
    registerSessionsIpc();

    // Lend the person's token to the chats of their applications only (A-20)
    lendTokenToAppChats();

    // Set up application event handlers
    Application.setupEventHandlers();

    // Initialize the application
    await Application.initialize();

    // The approvals' sources and the last folder's runtime (DESKTOP DK-05,
    // DK-13, DK-14); its refusal is logged, never shown at launch.
    void startSessionsServices();

    // Check for stored authentication and broadcast if authenticated
    const authState = sdkBridge.getAuthState();
    if (authState.isAuthenticated) {
      log.info(
        '[Main] Found stored authentication, broadcasting to renderer...'
      );
      // The menu opens up at once; the renderer hears it below.
      refreshMenu({ signedIn: true });
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
