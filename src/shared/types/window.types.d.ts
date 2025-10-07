/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Global window type augmentation for Datalayer Desktop.
 * Provides proper typing for all window extensions to eliminate 'as any' casts.
 *
 * @module types/window
 */

import type { ServiceManager } from '@jupyterlab/services';
import type { Logger } from 'electron-log';

declare global {
  interface Window {
    /**
     * Prism syntax highlighting library.
     * Used for code syntax highlighting in the application.
     */
    Prism?: {
      languages: Record<string, unknown>;
      [key: string]: unknown;
    };

    /**
     * Electron logger instance exposed to renderer.
     * Provides debug, info, warn, error logging methods.
     */
    logger?: Logger;

    /**
     * Runtime cleanup registry for managing ServiceManager lifecycle.
     * Maps runtime IDs to their cleanup handlers.
     */
    __datalayerRuntimeCleanup?: Map<
      string,
      {
        manager: ServiceManager.IManager;
        cleanup: () => void;
        terminated?: boolean;
      }
    >;

    /**
     * Cached ServiceManager instances.
     * Dynamic keys in format: 'serviceManager-${runtimeId}'
     */
    [key: `serviceManager-${string}`]: ServiceManager.IManager | undefined;

    /**
     * Datalayer configuration set at runtime.
     * Contains authentication token and run URL.
     */
    datalayerConfig?: {
      token: string;
      runUrl: string;
    };

    /**
     * Electron API exposed via preload script.
     * Provides system information and menu actions.
     */
    electronAPI: {
      getVersion: () => Promise<{ version: string; buildNumber: string }>;
      getEnv: () => Promise<{
        DATALAYER_RUN_URL: string;
        DATALAYER_TOKEN: string;
      }>;
      onMenuAction: (callback: (action: string) => void) => void;
      removeMenuActionListener: () => void;
      platform: NodeJS.Platform;
      closeAboutWindow: () => void;
      openExternal: (url: string) => void;
      notifyRuntimeTerminated: (
        runtimeId: string
      ) => Promise<{ success: boolean }>;
      onAuthStateChanged: (
        callback: (authState: {
          isAuthenticated: boolean;
          user: import('@datalayer/core/lib/client/models').UserJSON | null;
          token: string | null;
          runUrl: string;
        }) => void
      ) => void;
      removeAuthStateListener: () => void;
    };

    /**
     * Loro collaboration API for Lexical document editing.
     * Provides WebSocket connectivity for real-time CRDT collaboration.
     */
    loroAPI: {
      connect: (
        websocketUrl: string,
        adapterId: string
      ) => Promise<{ success: boolean; status: string }>;
      disconnect: (adapterId: string) => Promise<{ success: boolean }>;
      sendMessage: (
        adapterId: string,
        data: unknown
      ) => Promise<{ success: boolean }>;
      onAdapterEvent: (
        callback: (event: {
          type: string;
          adapterId: string;
          data?: {
            status?: string;
            message?: string;
            type?: string;
            bytes?: number[];
          };
        }) => void
      ) => void;
      removeEventListener: () => void;
    };

    /**
     * Proxy API for HTTP and WebSocket communication.
     * Provides secure tunneling to Jupyter kernels.
     */
    proxyAPI: {
      httpRequest: (options: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
      }) => Promise<{
        status: number;
        headers: Record<string, string>;
        body: unknown;
      }>;
      websocketOpen: (options: {
        url: string;
        protocol?: string;
        headers?: Record<string, string>;
        runtimeId?: string;
      }) => Promise<{ id: string }>;
      websocketSend: (options: { id: string; data: unknown }) => Promise<void>;
      websocketClose: (options: {
        id: string;
        code?: number;
        reason?: string;
      }) => Promise<void>;
      onWebsocketEvent: (
        callback: (event: {
          id: string;
          type: 'open' | 'message' | 'error' | 'close';
          data?: unknown;
          error?: string;
          code?: number;
          reason?: string;
        }) => void
      ) => void;
      removeWebsocketEventListener: () => void;
    };

    /**
     * Datalayer SDK client bridge.
     * Provides access to all SDK methods via IPC.
     */
    datalayerClient: {
      // Authentication
      login: (token: string) => Promise<{
        isAuthenticated: boolean;
        user: import('@datalayer/core/lib/client/models').UserJSON;
        token: string;
        runUrl: string;
      }>;
      logout: () => Promise<void>;
      whoami: () => Promise<
        import('@datalayer/core/lib/client/models').UserJSON
      >;
      getAuthState: () => Promise<{
        isAuthenticated: boolean;
        user: import('@datalayer/core/lib/client/models').UserJSON | null;
        token: string | null;
        runUrl: string;
      }>;
      getSpacerRunUrl: () => Promise<string>;

      // Environments
      listEnvironments: () => Promise<
        import('@datalayer/core/lib/client/models').EnvironmentJSON[]
      >;

      // Runtimes
      listRuntimes: () => Promise<
        import('@datalayer/core/lib/client/models').RuntimeJSON[]
      >;
      getRuntime: (
        runtimeId: string
      ) => Promise<import('@datalayer/core/lib/client/models').RuntimeJSON>;
      createRuntime: (options: {
        environmentName: string;
        type?: string;
        givenName?: string;
        minutesLimit?: number;
      }) => Promise<import('@datalayer/core/lib/client/models').RuntimeJSON>;
      deleteRuntime: (runtimeId: string) => Promise<void>;

      // Spaces
      listSpaces: () => Promise<
        import('@datalayer/core/lib/client/models').SpaceJSON[]
      >;
      getMySpaces: () => Promise<
        import('@datalayer/core/lib/client/models').SpaceJSON[]
      >;
      getSpaceItems: (
        spaceId: string
      ) => Promise<
        Array<
          | import('@datalayer/core/lib/client/models').NotebookJSON
          | import('@datalayer/core/lib/client/models').LexicalJSON
        >
      >;
      getContent: (itemId: string) => Promise<unknown>;
      deleteSpaceItem: (spaceId: string, itemId: string) => Promise<void>;

      // Notebooks
      listNotebooks: (
        spaceId: string
      ) => Promise<import('@datalayer/core/lib/client/models').NotebookJSON[]>;
      getNotebook: (
        notebookId: string
      ) => Promise<import('@datalayer/core/lib/client/models').NotebookJSON>;
      createNotebook: (
        spaceId: string,
        name: string,
        description?: string
      ) => Promise<import('@datalayer/core/lib/client/models').NotebookJSON>;
      updateNotebook: (
        notebookId: string,
        data: { name?: string; description?: string }
      ) => Promise<import('@datalayer/core/lib/client/models').NotebookJSON>;
      deleteNotebook: (notebookId: string) => Promise<void>;

      // Lexical documents
      createLexical: (
        spaceId: string,
        name: string,
        description?: string
      ) => Promise<import('@datalayer/core/lib/client/models').LexicalJSON>;
      deleteLexical: (lexicalId: string) => Promise<void>;
    };
  }
}

export {};
