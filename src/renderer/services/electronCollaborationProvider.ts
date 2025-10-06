/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Electron-aware collaboration provider for Datalayer.
 * Uses IPC bridge for secure collaborative document editing.
 *
 * @module renderer/services/electronCollaborationProvider
 */

import { YNotebook } from '@jupyter/ydoc';
import { WebsocketProvider } from 'y-websocket';
import { URLExt } from '@jupyterlab/coreutils';
import { Signal } from '@lumino/signaling';
import type {
  ICollaborationProvider,
  ICollaborationProviderEvents,
} from '@datalayer/jupyter-react';
// We'll use our ProxyWebSocket by passing it as WebSocket constructor to y-websocket

enum CollaborationStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

export interface IElectronCollaborationConfig {
  runUrl?: string;
  token?: string;
  runtimeId?: string;
}

/**
 * Electron Collaboration Provider that uses IPC for session ID requests
 */
export class ElectronCollaborationProvider implements ICollaborationProvider {
  readonly type = 'datalayer-electron';

  private _status: CollaborationStatus = CollaborationStatus.Disconnected;
  private _provider: WebsocketProvider | null = null;
  private _sharedModel: YNotebook | null = null;
  private _statusChanged = new Signal<this, CollaborationStatus>(this);
  private _errorOccurred = new Signal<this, Error>(this);
  private _syncStateChanged = new Signal<this, boolean>(this);
  private _isDisposed = false;

  private _config: IElectronCollaborationConfig;
  private _onSync: ((isSynced: boolean) => void) | null = null;
  private _onConnectionClose: ((event: CloseEvent | null) => void) | null =
    null;

  constructor(config: IElectronCollaborationConfig) {
    this._config = config;
  }

  get status(): CollaborationStatus {
    return this._status;
  }

  get isConnected(): boolean {
    return this._status === CollaborationStatus.Connected;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get events(): ICollaborationProviderEvents {
    return {
      statusChanged: this._statusChanged,
      errorOccurred: this._errorOccurred,
      syncStateChanged: this._syncStateChanged,
    };
  }

  private setStatus(status: CollaborationStatus): void {
    if (this._status !== status) {
      this._status = status;
      this._statusChanged.emit(status);
    }
  }

  async connect(
    sharedModel: YNotebook,
    documentId: string,
    options?: Record<string, unknown>
  ): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this.setStatus(CollaborationStatus.Connecting);

    try {
      // RACE CONDITION PREVENTION: Check if runtime is terminated before creating WebSocket connections
      const runtimeId = this._config.runtimeId;
      if (runtimeId) {
        const cleanupRegistry = (window as any).__datalayerRuntimeCleanup;
        if (
          cleanupRegistry &&
          cleanupRegistry.has(runtimeId) &&
          cleanupRegistry.get(runtimeId).terminated
        ) {
          // RACE CONDITION PREVENTION: Blocking collaboration WebSocket for terminated runtime
          throw new Error(
            `Runtime ${runtimeId} has been terminated - no new collaboration connections allowed`
          );
        }
      }

      const runUrl = this._config.runUrl;
      let configToken = this._config.token;

      if (!runUrl) {
        throw new Error('Datalayer runUrl is not configured');
      }

      if (!window.datalayerClient) {
        throw new Error(
          'Datalayer API not available - collaboration requires IPC bridge'
        );
      }

      // Handle token securely - in Electron, the renderer stores 'secured' for security
      if (configToken === 'secured') {
        try {
          const tokenResponse =
            await window.datalayerClient.getCollaborationToken();
          if (tokenResponse.isAuthenticated && tokenResponse.token) {
            configToken = tokenResponse.token;
          } else {
            configToken = undefined;
          }
        } catch (error) {
          // Error getting collaboration token
          configToken = undefined;
        }
      }

      const { ydoc, awareness } = sharedModel;

      // Build WebSocket URL for collaboration
      const documentURL = URLExt.join(runUrl, '/api/spacer/v1/documents/ws');
      const wsUrl = documentURL.replace(/^http/, 'ws');

      // Request collaboration session from Datalayer via IPC
      if (!window.datalayerClient) {
        throw new Error(
          'Datalayer API not available - collaboration requires IPC bridge'
        );
      }

      // Request collaboration session from Datalayer via IPC
      let sessionId;
      if (window.datalayerClient.getCollaborationSession) {
        sessionId =
          await window.datalayerClient.getCollaborationSession(documentId);
      } else {
        // Fallback: use request method (this would need to be updated too if used)
        throw new Error('No collaboration session method available');
      }

      if (!sessionId) {
        throw new Error('Failed to get collaboration session ID');
      }

      // Import ProxyWebSocket class dynamically to use with WebsocketProvider
      const { ProxyWebSocket } = await import('./proxyServiceManager');

      // Create a runtime-aware WebSocket factory with runtime ID
      const RuntimeProxyWebSocket = class extends ProxyWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols, undefined, runtimeId);
        }
      };

      // Configure WebSocket params
      const wsParams = {
        sessionId,
        ...(configToken && { token: configToken }), // Include real token if available
      };

      // FINAL RACE CONDITION CHECK: Verify runtime is still not terminated before creating WebSocket
      if (runtimeId) {
        const cleanupRegistry = (window as any).__datalayerRuntimeCleanup;
        if (
          cleanupRegistry &&
          cleanupRegistry.has(runtimeId) &&
          cleanupRegistry.get(runtimeId).terminated
        ) {
          // FINAL CHECK: Runtime terminated during connection setup, aborting
          throw new Error(
            `Runtime ${runtimeId} has been terminated during collaboration setup - no new connections allowed`
          );
        }
      }

      // Create WebSocket provider
      // Both sessionId and token are passed as params to y-websocket

      this._provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
        disableBc: true,
        params: wsParams,
        awareness,
        WebSocketPolyfill: RuntimeProxyWebSocket as typeof WebSocket,
        ...options,
      });

      this._sharedModel = sharedModel;

      // Set up event handlers
      this._onSync = (isSynced: boolean) => {
        this.handleSync(isSynced);
      };
      this._onConnectionClose = (event: CloseEvent | null) => {
        if (event) {
          this.handleConnectionClose(event);
        }
      };

      this._provider.on('sync', this._onSync);
      this._provider.on('connection-close', this._onConnectionClose);
    } catch (error) {
      console.error('[ElectronCollaboration] Connection error:', error);
      this.setStatus(CollaborationStatus.Error);
      this._errorOccurred.emit(error as Error);
      throw error;
    }
  }

  disconnect(): void {
    if (this._provider) {
      if (this._onSync) {
        this._provider.off('sync', this._onSync);
      }
      if (this._onConnectionClose) {
        this._provider.off('connection-close', this._onConnectionClose);
      }
      this._provider.disconnect();
      this._provider = null;
    }
    this._sharedModel = null;
    this.setStatus(CollaborationStatus.Disconnected);
  }

  getProvider(): WebsocketProvider | null {
    return this._provider;
  }

  getSharedModel(): YNotebook | null {
    return this._sharedModel;
  }

  handleConnectionClose(event: CloseEvent): void {
    this.setStatus(CollaborationStatus.Disconnected);

    // Handle session expiration (code 4002)
    if (event.code === 4002) {
      // Attempt to reconnect could be implemented here
    }
  }

  handleSync(isSynced: boolean): void {
    this._syncStateChanged.emit(isSynced);
    if (isSynced) {
      this.setStatus(CollaborationStatus.Connected);
    }
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this.disconnect();
    this._isDisposed = true;
  }
}
