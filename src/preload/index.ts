/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Preload script providing secure bridge between main and renderer processes.
 * Exposes electronAPI, proxyAPI, and datalayerClient to the renderer via context isolation.
 *
 * @module preload/index
 */

import { contextBridge, ipcRenderer } from 'electron';
// import log from 'electron-log/renderer'; // Uncomment when needed for logging

// Import types from SDK - these are compile-time only
import type {
  EnvironmentJSON,
  RuntimeJSON,
  NotebookJSON,
  SpaceJSON,
  LexicalJSON,
  UserJSON,
} from '@datalayer/agent-runtimes/lib/models';
import type { DesktopAPI } from '../shared/types/ipc.types';

/**
 * Electron API for system information and menu actions.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app version info
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Get environment variables
  getEnv: () => ipcRenderer.invoke('get-env'),

  // Listen for menu actions
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_, action) => callback(action));
  },

  // Remove menu action listener
  removeMenuActionListener: () => {
    ipcRenderer.removeAllListeners('menu-action');
  },

  // Platform info
  platform: process.platform,

  // About dialog methods
  closeAboutWindow: () => ipcRenderer.send('close-about-window'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),

  // Runtime termination notification
  notifyRuntimeTerminated: (runtimeId: string) =>
    ipcRenderer.invoke('runtime-terminated', { runtimeId }),

  // Auth state change listener
  onAuthStateChanged: (
    callback: (authState: {
      isAuthenticated: boolean;
      user: UserJSON | null;
      token: string | null;
      runUrl: string;
    }) => void
  ) => {
    ipcRenderer.on('auth-state-changed', (_, authState) => callback(authState));
  },

  // Remove auth state change listener
  removeAuthStateListener: () => {
    ipcRenderer.removeAllListeners('auth-state-changed');
  },
});

/**
 * Proxy API for HTTP and WebSocket communication with Jupyter kernels.
 */
contextBridge.exposeInMainWorld('proxyAPI', {
  // HTTP proxy
  httpRequest: (options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }) => ipcRenderer.invoke('proxy:http-request', options),

  // WebSocket proxy
  websocketOpen: (options: {
    url: string;
    protocol?: string;
    headers?: Record<string, string>;
    runtimeId?: string;
  }) => ipcRenderer.invoke('proxy:websocket-open', options),

  websocketSend: (options: { id: string; data: unknown }) =>
    ipcRenderer.invoke('proxy:websocket-send', options),

  websocketClose: (options: { id: string; code?: number; reason?: string }) =>
    ipcRenderer.invoke('proxy:websocket-close', options),

  websocketCloseRuntime: (options: { runtimeId: string }) =>
    ipcRenderer.invoke('proxy:websocket-close-runtime', options),

  // Listen for WebSocket events
  onWebSocketEvent: (
    callback: (event: {
      id: string;
      type: 'open' | 'message' | 'close' | 'error';
      data?: unknown;
      code?: number;
      reason?: string;
      error?: string;
    }) => void
  ) => {
    ipcRenderer.on('websocket-event', (_, event) => callback(event));
  },

  // Remove WebSocket event listener
  removeWebSocketEventListener: () => {
    ipcRenderer.removeAllListeners('websocket-event');
  },
});

/**
 * Loro collaboration API for Lexical document editing.
 */
contextBridge.exposeInMainWorld('loroAPI', {
  connect: (websocketUrl: string, adapterId: string) =>
    ipcRenderer.invoke('loro:connect', { adapterId, websocketUrl }),

  disconnect: (adapterId: string) =>
    ipcRenderer.invoke('loro:disconnect', { adapterId }),

  sendMessage: (adapterId: string, data: unknown) =>
    ipcRenderer.invoke('loro:send-message', { adapterId, data }),

  onAdapterEvent: (callback: (event: unknown) => void) => {
    ipcRenderer.on('loro:adapter-event', (_, event) => callback(event));
  },

  removeEventListener: () => {
    ipcRenderer.removeAllListeners('loro:adapter-event');
  },
});

/**
 * Datalayer API for authentication, runtime management, and notebook operations.
 */
contextBridge.exposeInMainWorld('datalayerClient', {
  // Authentication - SDK only needs token, uses default URLs
  login: (token: string) => ipcRenderer.invoke('datalayer:login', { token }),

  logout: () => ipcRenderer.invoke('datalayer:logout'),

  // Get current auth state with user data
  getAuthState: () => ipcRenderer.invoke('datalayer:get-auth-state'),

  // API calls
  listEnvironments: () => ipcRenderer.invoke('datalayer:list-environments'),

  createRuntime: (options: {
    environmentName: string;
    type: 'notebook' | 'terminal' | 'job';
    givenName: string;
    minutesLimit: number;
  }) => ipcRenderer.invoke('datalayer:create-runtime', options),

  deleteRuntime: (runtimeId: string) =>
    ipcRenderer.invoke('datalayer:delete-runtime', runtimeId),

  terminateAllRuntimes: () =>
    ipcRenderer.invoke('datalayer:terminate-all-runtimes'),

  getRuntime: (runtimeId: string) =>
    ipcRenderer.invoke('datalayer:get-runtime', runtimeId),

  isRuntimeActive: (runtimeName: string) =>
    ipcRenderer.invoke('datalayer:is-runtime-active', runtimeName),

  listRuntimes: () => ipcRenderer.invoke('datalayer:list-runtimes'),

  // Notebooks
  listNotebooks: () => ipcRenderer.invoke('datalayer:list-notebooks'),

  createNotebook: (spaceId: string, name: string, description?: string) =>
    ipcRenderer.invoke('datalayer:create-notebook', {
      spaceId,
      name,
      description,
    }),

  updateNotebook: (uid: string, name: string, description?: string) =>
    ipcRenderer.invoke('datalayer:update-notebook', {
      uid,
      name,
      description,
    }),

  deleteSpaceItem: (spaceId: string, itemId: string) =>
    ipcRenderer.invoke('datalayer:delete-space-item', {
      spaceId,
      itemId,
    }),

  getMySpaces: () => ipcRenderer.invoke('datalayer:get-my-spaces'),

  getSpaceItems: (spaceId: string) =>
    ipcRenderer.invoke('datalayer:get-space-items', spaceId),

  getContent: (itemId: string) =>
    ipcRenderer.invoke('datalayer:get-content', itemId),

  createLexical: (spaceId: string, name: string, description: string) =>
    ipcRenderer.invoke('datalayer:create-lexical', {
      spaceId,
      name,
      description,
    }),

  updateLexical: (uid: string, name: string, description?: string) =>
    ipcRenderer.invoke('datalayer:update-lexical', {
      uid,
      name,
      description,
    }),

  // Collaboration
  getCollaborationSession: (documentId: string) =>
    ipcRenderer.invoke('datalayer:get-collaboration-session', documentId),

  getCollaborationToken: () =>
    ipcRenderer.invoke('datalayer:get-collaboration-token'),

  // User API
  whoami: () => ipcRenderer.invoke('datalayer:whoami'),

  // Configuration
  getSpacerRunUrl: () => ipcRenderer.invoke('datalayer:get-spacer-run-url'),
});

/**
 * A deployed application's agent (STUDIO A-20): the person's deployments,
 * listed by the main process. No token is handed over: the main process
 * lends it to the requests of the runtimes listed.
 */
contextBridge.exposeInMainWorld('appChatAPI', {
  enabled: () => ipcRenderer.invoke('app-chat:enabled'),
  listDeployments: () => ipcRenderer.invoke('app-chat:list-deployments'),
  userToken: (deploymentUid: string) =>
    ipcRenderer.invoke('app-chat:user-token', deploymentUid),
});

/**
 * Sessions (DESKTOP §7): the contract between the renderer and the main
 * process, typed in `shared/types/ipc.types.ts`. The renderer never holds
 * the token: the main process reads the two places and lends the token
 * where it is needed; a local runtime needs none.
 */
const on = (channel: string, listener: (...args: unknown[]) => void) => {
  const wrapped = (_event: unknown, ...args: unknown[]) => listener(...args);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
};

const desktopAPI: DesktopAPI = {
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    onChanged: callback => on('sessions:changed', () => callback()),
  },
  localRuntime: {
    start: folder => ipcRenderer.invoke('local-runtime:start', { folder }),
    stop: folder => ipcRenderer.invoke('local-runtime:stop', { folder }),
    running: () => ipcRenderer.invoke('local-runtime:running'),
    recentFolders: () => ipcRenderer.invoke('local-runtime:recent-folders'),
    harnesses: url => ipcRenderer.invoke('local-runtime:harnesses', { url }),
    checkHarness: (url, id) =>
      ipcRenderer.invoke('local-runtime:check-harness', { url, id }),
    setupHarness: (url, id) =>
      ipcRenderer.invoke('local-runtime:setup-harness', { url, id }),
    storeCredential: (name, value) =>
      ipcRenderer.invoke('credentials:store', { name, value }),
  },
  approvals: {
    pending: () => ipcRenderer.invoke('approvals:pending'),
    decide: (place, id, decision) =>
      ipcRenderer.invoke('approvals:decide', { place, id, decision }),
    onChanged: callback => on('approvals:changed', () => callback()),
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
    save: (name, text) => ipcRenderer.invoke('dialog:save', { name, text }),
    openFile: accept => ipcRenderer.invoke('dialog:open-file', { accept }),
  },
  shell: {
    reveal: path => ipcRenderer.invoke('shell:reveal', { path }),
  },
  studio: {
    open: path => ipcRenderer.invoke('studio:open', { path }),
  },
  attention: {
    onFocus: callback =>
      on('attention:focus', payload => {
        const uid = (payload as { uid?: unknown } | undefined)?.uid;
        if (typeof uid === 'string') {
          callback(uid);
        }
      }),
  },
};

contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);

/**
 * Sign-in in the Studio view (DESKTOP DK-03): the main process opens IAM's
 * provider page there and keeps the token; the renderer never sees it.
 */
const signInAPI: SignInAPI = {
  start: (provider: SignInProvider) =>
    ipcRenderer.invoke('sign-in:start', { provider }),
  onFailed: (callback: (sentence: string) => void) => {
    ipcRenderer.on('sign-in:failed', (_, sentence: string) =>
      callback(sentence)
    );
  },
  removeFailedListener: () => {
    ipcRenderer.removeAllListeners('sign-in:failed');
  },
};
contextBridge.exposeInMainWorld('signInAPI', signInAPI);

/**
 * The Studio, embedded (DESKTOP DK-02): shown where the renderer says,
 * hidden with its page kept, sent to a path of the Studio.
 */
const studioAPI: StudioAPI = {
  show: (bounds: StudioBounds) => ipcRenderer.invoke('studio:show', bounds),
  hide: () => ipcRenderer.invoke('studio:hide'),
  open: (path: string) => ipcRenderer.invoke('studio:open', { path }),
};
contextBridge.exposeInMainWorld('studioAPI', studioAPI);

/**
 * The menu (DESKTOP DK-04): what the renderer shows, so the entries enable.
 */
const menuAPI: MenuAPI = {
  setState: (state: MenuRendererState) =>
    ipcRenderer.invoke('menu:state', state),
};
contextBridge.exposeInMainWorld('menuAPI', menuAPI);

/**
 * Proxy API interface for HTTP and WebSocket communication.
 */
export interface ProxyAPI {
  httpRequest: (options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }) => Promise<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
  }>;
  websocketOpen: (options: {
    url: string;
    protocol?: string;
    headers?: Record<string, string>;
    runtimeId?: string;
  }) => Promise<{ id: string }>;
  websocketSend: (options: {
    id: string;
    data: unknown;
  }) => Promise<{ success: boolean }>;
  websocketClose: (options: {
    id: string;
    code?: number;
    reason?: string;
  }) => Promise<{ success: boolean }>;
  websocketCloseRuntime: (options: {
    runtimeId: string;
  }) => Promise<{ success: boolean }>;
  onWebSocketEvent: (
    callback: (event: {
      id: string;
      type: 'open' | 'message' | 'close' | 'error';
      data?: unknown;
      code?: number;
      reason?: string;
      error?: string;
    }) => void
  ) => void;
  removeWebSocketEventListener: () => void;
}

/**
 * Electron API interface for system and application information.
 */
export interface ElectronAPI {
  getVersion: () => Promise<{
    electron: string;
    node: string;
    chrome: string;
    app: string;
  }>;
  getEnv: () => Promise<{
    DATALAYER_RUN_URL: string;
    DATALAYER_TOKEN: string;
  }>;
  onMenuAction: (callback: (action: string) => void) => void;
  removeMenuActionListener: () => void;
  platform: NodeJS.Platform;
  closeAboutWindow: () => void;
  openExternal: (url: string) => void;
  onAuthStateChanged: (
    callback: (authState: {
      isAuthenticated: boolean;
      user: UserJSON | null;
      token: string | null;
      runUrl: string;
    }) => void
  ) => void;
  removeAuthStateListener: () => void;
}

/**
 * Datalayer IPC Bridge API interface.
 * Provides methods for interacting with the Datalayer SDK via IPC.
 */
export interface DatalayerIPCClient {
  // Authentication methods - return void on success, throw on error
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;

  // Auth state - returns complete auth state with user data
  getAuthState: () => Promise<{
    isAuthenticated: boolean;
    user: UserJSON | null;
    token: string | null;
    runUrl: string;
  }>;

  // Environment and runtime methods - return SDK JSON types directly
  listEnvironments: () => Promise<
    Array<
      EnvironmentJSON & {
        icon?: string;
        resources?: Record<string, unknown>;
        language?: string;
        dockerImage?: string;
        tags?: string[];
      }
    >
  >;
  createRuntime: (options: {
    environmentName: string;
    type: 'notebook' | 'terminal' | 'job';
    givenName: string;
    minutesLimit: number;
  }) => Promise<RuntimeJSON>;
  deleteRuntime: (runtimeName: string) => Promise<void>;
  terminateAllRuntimes: () => Promise<PromiseSettledResult<void>[]>;
  getRuntime: (runtimeId: string) => Promise<RuntimeJSON>;
  listRuntimes: () => Promise<RuntimeJSON[]>;

  // Special runtime method with custom return type
  isRuntimeActive: (runtimeName: string) => Promise<{
    isActive: boolean;
    runtime?: RuntimeJSON;
  }>;

  // Notebook/Space methods - return SDK JSON types directly
  listNotebooks: () => Promise<NotebookJSON[]>;
  createNotebook: (
    spaceId: string,
    name: string,
    description?: string
  ) => Promise<NotebookJSON>;
  updateNotebook: (
    uid: string,
    name: string,
    description?: string
  ) => Promise<NotebookJSON>;
  deleteSpaceItem: (spaceId: string, itemId: string) => Promise<void>;
  getMySpaces: () => Promise<SpaceJSON[]>;
  getSpaceItems: (
    spaceId: string
  ) => Promise<Array<NotebookJSON | LexicalJSON>>;
  getContent: (itemId: string) => Promise<unknown>;
  createLexical: (
    spaceId: string,
    name: string,
    description: string
  ) => Promise<LexicalJSON>;
  updateLexical: (
    uid: string,
    name: string,
    description?: string
  ) => Promise<LexicalJSON>;

  // Collaboration methods
  getCollaborationSession: (documentId: string) => Promise<string>; // Returns session ID directly
  getCollaborationToken: () => Promise<{
    runUrl: string;
    token?: string;
    isAuthenticated: boolean;
  }>;

  // User methods
  whoami: () => Promise<UserJSON>;
}

/**
 * Global window interface extensions.
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    datalayerClient: DatalayerIPCClient;
    proxyAPI: ProxyAPI;
    /** The sessions contract (DESKTOP §7). */
    desktopAPI: DesktopAPI;
  }
}
