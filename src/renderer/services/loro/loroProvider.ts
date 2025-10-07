/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Desktop Loro provider implementation.
 * Implements Loro's Provider interface using Electron IPC to communicate with Main Process.
 *
 * @module renderer/services/loro/loroProvider
 */

import { LoroDoc, EphemeralStore } from 'loro-crdt';
import type { Provider, AwarenessProvider } from '@datalayer/lexical-loro';
import { AwarenessAdapter } from './awarenessAdapter';

/**
 * Message types for Main Process communication
 */
interface LoroMessage {
  type: 'connect' | 'disconnect' | 'message' | 'status' | 'error';
  adapterId: string;
  data?: unknown;
}

/**
 * WebSocket message protocol
 */
interface WebSocketMessage {
  type: 'update' | 'ephemeral' | 'query-snapshot' | 'query-ephemeral';
  bytes?: number[];
  update?: number[]; // Server may send 'update' field instead of 'bytes'
  ephemeral?: number[];
  docId?: string;
  [key: string]: unknown;
}

/**
 * Provider implementation for Desktop Electron environment.
 * Uses IPC to communicate with Main Process's WebSocket adapter.
 */
export class DesktopLoroProvider implements Provider {
  private readonly adapterId: string;
  private readonly doc: LoroDoc;
  private readonly ephemeralStore: EphemeralStore;
  private readonly _awareness: AwarenessAdapter;
  private syncListeners: Set<(isSynced: boolean) => void> = new Set();
  private statusListeners: Set<(status: { status: string }) => void> =
    new Set();
  private updateListeners: Set<(update: unknown) => void> = new Set();
  private reloadListeners: Set<(doc: LoroDoc) => void> = new Set();
  private isSynced = false;
  private eventHandler: ((event: unknown) => void) | null = null;

  private websocketUrl: string;
  private documentId: string;
  private token: string;

  constructor(
    adapterId: string,
    doc: LoroDoc,
    userName: string,
    userColor: string,
    websocketUrl?: string,
    token?: string
  ) {
    this.adapterId = adapterId;
    this.doc = doc;
    this.websocketUrl = websocketUrl || '';
    this.token = token || '';
    // Extract document ID from adapter ID (format: "loro-{documentId}")
    this.documentId = adapterId.replace(/^loro-/, '');

    // Create shared ephemeral store (5 minute timeout)
    this.ephemeralStore = new EphemeralStore(300000);

    // Create awareness adapter with the shared ephemeral store
    this._awareness = new AwarenessAdapter(
      doc,
      userName,
      userColor,
      this.ephemeralStore
    );

    // Subscribe to local document changes
    doc.subscribeLocalUpdates((update: Uint8Array) => {
      // Send local updates to server via Main Process
      const updateArray = Array.from(update);
      this.sendToMainProcess({
        type: 'message',
        adapterId: this.adapterId,
        data: { type: 'update', update: updateArray },
      });
    });

    // Subscribe to awareness changes
    this._awareness.on('update', () => {
      // Send awareness state to server
      const state = this._awareness.getLocalState();
      if (state) {
        const stateBytes = Array.from(this._awareness.encodeLocalState());
        this.sendToMainProcess({
          type: 'message',
          adapterId: this.adapterId,
          data: {
            type: 'ephemeral',
            ephemeral: stateBytes,
            docId: this.documentId,
          },
        });
      }
    });
  }

  /**
   * Get the awareness provider
   */
  get awareness(): AwarenessProvider {
    return this._awareness;
  }

  /**
   * Connect to the collaboration server
   */
  connect(): void {
    // Setup event listener
    this.eventHandler = this.handleMainProcessMessage.bind(this);
    window.loroAPI.onAdapterEvent(this.eventHandler);

    // Send connect message to Main Process with auth token
    this.sendToMainProcess({
      type: 'connect',
      adapterId: this.adapterId,
      data: {
        websocketUrl: this.websocketUrl,
        token: this.token,
      },
    });
  }

  /**
   * Disconnect from the collaboration server
   */
  disconnect(): void {
    this.sendToMainProcess({
      type: 'disconnect',
      adapterId: this.adapterId,
    });

    // Clean up event listener
    if (this.eventHandler) {
      window.loroAPI.removeEventListener();
      this.eventHandler = null;
    }

    this._awareness.dispose();
  }

  /**
   * Register event listener
   */
  on(type: 'sync', cb: (isSynced: boolean) => void): void;
  on(type: 'status', cb: (status: { status: string }) => void): void;
  on(type: 'update', cb: (update: unknown) => void): void;
  on(type: 'reload', cb: (doc: LoroDoc) => void): void;
  on(type: string, cb: Function): void {
    switch (type) {
      case 'sync':
        this.syncListeners.add(cb as (isSynced: boolean) => void);
        break;
      case 'status':
        this.statusListeners.add(cb as (status: { status: string }) => void);
        break;
      case 'update':
        this.updateListeners.add(cb as (update: unknown) => void);
        break;
      case 'reload':
        this.reloadListeners.add(cb as (doc: LoroDoc) => void);
        break;
    }
  }

  /**
   * Unregister event listener
   */
  off(type: 'sync', cb: (isSynced: boolean) => void): void;
  off(type: 'status', cb: (status: { status: string }) => void): void;
  off(type: 'update', cb: (update: unknown) => void): void;
  off(type: 'reload', cb: (doc: LoroDoc) => void): void;
  off(type: string, cb: Function): void {
    switch (type) {
      case 'sync':
        this.syncListeners.delete(cb as (isSynced: boolean) => void);
        break;
      case 'status':
        this.statusListeners.delete(cb as (status: { status: string }) => void);
        break;
      case 'update':
        this.updateListeners.delete(cb as (update: unknown) => void);
        break;
      case 'reload':
        this.reloadListeners.delete(cb as (doc: LoroDoc) => void);
        break;
    }
  }

  /**
   * Handle messages from the Main Process
   */
  private handleMainProcessMessage(messageData: unknown): void {
    const message = messageData as LoroMessage;

    // Only handle messages for this adapter
    if (message.adapterId !== this.adapterId) {
      return;
    }

    switch (message.type) {
      case 'status': {
        const status = message.data as { status: string };

        // Notify status listeners
        this.statusListeners.forEach(cb => cb(status));

        // Handle connection status
        if (status.status === 'connected') {
          // Request snapshot and ephemeral state on connect
          this.sendToMainProcess({
            type: 'message',
            adapterId: this.adapterId,
            data: { type: 'query-snapshot' },
          });

          this.sendToMainProcess({
            type: 'message',
            adapterId: this.adapterId,
            data: { type: 'query-ephemeral' },
          });

          // Send initial awareness state to server
          const state = this._awareness.getLocalState();
          if (state) {
            const stateBytes = Array.from(this._awareness.encodeLocalState());
            this.sendToMainProcess({
              type: 'message',
              adapterId: this.adapterId,
              data: {
                type: 'ephemeral',
                ephemeral: stateBytes,
                docId: this.documentId,
              },
            });
          }
        } else if (status.status === 'disconnected') {
          this.isSynced = false;
          this.syncListeners.forEach(cb => cb(false));
        }
        break;
      }

      case 'message': {
        const wsMessage = message.data as WebSocketMessage;
        this.handleWebSocketMessage(wsMessage);
        break;
      }

      case 'error': {
        const error = message.data as { message: string };
        console.error(`[DesktopLoroProvider] Error:`, error.message);
        break;
      }
    }
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'update': {
        // Remote document update - import into local doc
        const updateData = message.bytes || message.update;
        if (updateData && Array.isArray(updateData)) {
          const bytes = new Uint8Array(updateData);
          this.doc.import(bytes);

          // Notify update listeners
          this.updateListeners.forEach(cb => cb(bytes));

          // Mark as synced on first update
          if (!this.isSynced) {
            this.isSynced = true;
            this.syncListeners.forEach(cb => cb(true));
          }
        }
        break;
      }

      case 'ephemeral': {
        // Remote awareness state - decode and apply
        if (message.ephemeral && Array.isArray(message.ephemeral)) {
          const bytes = new Uint8Array(message.ephemeral);
          this._awareness.decodeRemoteState(bytes);
        }
        break;
      }

      default:
        console.warn(
          `[DesktopLoroProvider ${this.adapterId}] Unknown message type:`,
          message.type
        );
    }
  }

  /**
   * Send a message to the Main Process
   */
  private sendToMainProcess(message: LoroMessage): void {
    if (message.type === 'message') {
      // Use sendMessage for data messages
      window.loroAPI.sendMessage(this.adapterId, message.data);
    } else if (message.type === 'connect') {
      // Use connect for connection messages
      const data = message.data as { websocketUrl: string };
      window.loroAPI.connect(data.websocketUrl, this.adapterId);
    } else if (message.type === 'disconnect') {
      // Use disconnect for disconnection messages
      window.loroAPI.disconnect(this.adapterId);
    }
  }
}
