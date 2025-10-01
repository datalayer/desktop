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
} from '@datalayer/core/lib/client/models';
import { User } from '@datalayer/core/lib/client/models/User';

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
      user: any | null;
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
 * Datalayer API for authentication, runtime management, and notebook operations.
 */
contextBridge.exposeInMainWorld('datalayerClient', {
  // Authentication - SDK only needs token, uses default URLs
  login: (token: string) => ipcRenderer.invoke('datalayer:login', { token }),

  logout: () => ipcRenderer.invoke('datalayer:logout'),

  getCredentials: () => ipcRenderer.invoke('datalayer:get-credentials'),

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

  getRuntime: (runtimeId: string) =>
    ipcRenderer.invoke('datalayer:get-runtime', runtimeId),

  isRuntimeActive: (podName: string) =>
    ipcRenderer.invoke('datalayer:is-runtime-active', podName),

  listRuntimes: () => ipcRenderer.invoke('datalayer:list-runtimes'),

  // Notebooks
  listNotebooks: () => ipcRenderer.invoke('datalayer:list-notebooks'),

  createNotebook: (spaceId: string, name: string, description?: string) =>
    ipcRenderer.invoke('datalayer:create-notebook', {
      spaceId,
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
      user: any | null;
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

  // Credentials - special case, returns custom type
  getCredentials: () => Promise<{
    runUrl: string;
    token?: string;
    isAuthenticated: boolean;
  }>;

  // Auth state - returns complete auth state with user data
  getAuthState: () => Promise<{
    isAuthenticated: boolean;
    user: any | null;
    token: string | null;
    runUrl: string;
  }>;

  // Environment and runtime methods - return SDK JSON types directly
  listEnvironments: () => Promise<EnvironmentJSON[]>;
  createRuntime: (options: {
    environmentName: string;
    type: 'notebook' | 'terminal' | 'job';
    givenName: string;
    minutesLimit: number;
  }) => Promise<RuntimeJSON>;
  deleteRuntime: (podName: string) => Promise<void>;
  getRuntime: (runtimeId: string) => Promise<RuntimeJSON>;
  listRuntimes: () => Promise<RuntimeJSON[]>;

  // Special runtime method with custom return type
  isRuntimeActive: (podName: string) => Promise<{
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
  deleteSpaceItem: (spaceId: string, itemId: string) => Promise<void>;
  getMySpaces: () => Promise<SpaceJSON[]>;
  getSpaceItems: (
    spaceId: string
  ) => Promise<Array<NotebookJSON | LexicalJSON>>;
  getContent: (itemId: string) => Promise<any>;
  createLexical: (
    spaceId: string,
    name: string,
    description: string
  ) => Promise<LexicalJSON>;

  // Collaboration methods
  getCollaborationSession: (documentId: string) => Promise<string>; // Returns session ID directly
  getCollaborationToken: () => Promise<{
    runUrl: string;
    token?: string;
    isAuthenticated: boolean;
  }>;

  // User methods
  whoami: () => Promise<User>;
}

/**
 * Global window interface extensions.
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    datalayerClient: DatalayerIPCClient;
    proxyAPI: ProxyAPI;
  }
}
