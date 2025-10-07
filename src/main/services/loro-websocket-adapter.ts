/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Main Process WebSocket adapter for Loro collaboration.
 * Manages WebSocket connection to Loro collaboration server and proxies messages to/from renderer.
 *
 * @module main/services/loro-websocket-adapter
 */

import { BrowserWindow } from 'electron';
import WebSocket from 'ws';
import log from 'electron-log/main';

/**
 * Message types exchanged between Main Process and Renderer
 */
interface LoroMessage {
  type: 'connect' | 'disconnect' | 'message' | 'status' | 'error';
  adapterId: string;
  data?: unknown;
}

/**
 * WebSocket adapter that runs in Main Process (Node.js context).
 * Manages WebSocket connection to Loro collaboration server.
 * Proxies binary Loro update messages between renderer and server.
 */
export class LoroWebSocketAdapter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = 100;
  private maxReconnectDelay = 2500;
  private isDisposed = false;
  private messageQueue: unknown[] = [];
  private readonly maxQueueSize = 1000;
  private readonly token: string;

  constructor(
    private readonly adapterId: string,
    private readonly websocketUrl: string,
    private readonly window: BrowserWindow,
    token?: string
  ) {
    this.token = token || '';
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws || this.isDisposed) {
      return;
    }

    try {
      log.debug(
        `[LoroAdapter ${this.adapterId}] Connecting to ${this.websocketUrl}`
      );

      // Create WebSocket with Authorization header
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
        log.debug(
          `[LoroAdapter ${this.adapterId}] Adding Authorization header (token length: ${this.token.length})`
        );
      }

      this.ws = new WebSocket(this.websocketUrl, {
        headers,
      });

      this.ws.on('open', () => {
        log.debug(`[LoroAdapter ${this.adapterId}] WebSocket connected`);
        this.reconnectDelay = 100; // Reset backoff
        this.sendToRenderer({
          type: 'status',
          adapterId: this.adapterId,
          data: { status: 'connected' },
        });

        // Flush queued messages
        this.flushMessageQueue();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          // Parse the message to determine type
          const buffer =
            data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer);

          // Try to parse as JSON first
          try {
            const json = JSON.parse(buffer.toString());
            this.sendToRenderer({
              type: 'message',
              adapterId: this.adapterId,
              data: json,
            });
          } catch {
            // Not JSON, treat as binary (Loro update bytes)
            const bytes = Array.from(buffer);
            this.sendToRenderer({
              type: 'message',
              adapterId: this.adapterId,
              data: { type: 'update', bytes },
            });
          }
        } catch (error) {
          log.error(
            `[LoroAdapter ${this.adapterId}] Error processing message:`,
            error
          );
        }
      });

      this.ws.on('close', () => {
        log.debug(`[LoroAdapter ${this.adapterId}] WebSocket closed`);
        this.ws = null;

        this.sendToRenderer({
          type: 'status',
          adapterId: this.adapterId,
          data: { status: 'disconnected' },
        });

        // Attempt reconnection with exponential backoff
        if (!this.isDisposed) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error: Error) => {
        log.error(`[LoroAdapter ${this.adapterId}] WebSocket error:`, error);
        this.sendToRenderer({
          type: 'error',
          adapterId: this.adapterId,
          data: { message: error.message },
        });
      });
    } catch (error) {
      log.error(
        `[LoroAdapter ${this.adapterId}] Failed to create WebSocket:`,
        error
      );
      this.sendToRenderer({
        type: 'error',
        adapterId: this.adapterId,
        data: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Check if WebSocket is currently connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message to the WebSocket server
   */
  send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message for later delivery
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push(data);
      }
      return;
    }

    try {
      if (typeof data === 'string') {
        // String message (JSON)
        this.ws.send(data);
      } else if (Array.isArray(data)) {
        // Array of bytes (Loro update)
        const buffer = Buffer.from(data);
        this.ws.send(buffer);
      } else if (typeof data === 'object' && data !== null) {
        // Object - stringify as JSON
        this.ws.send(JSON.stringify(data));
      }
    } catch (error) {
      log.error(
        `[LoroAdapter ${this.adapterId}] Error sending message:`,
        error
      );
    }
  }

  /**
   * Handle incoming messages from the renderer
   */
  handleMessage(message: LoroMessage): void {
    switch (message.type) {
      case 'connect':
        this.connect();
        break;

      case 'disconnect':
        this.disconnect();
        break;

      case 'message':
        this.send(message.data);
        break;
    }
  }

  /**
   * Flush queued messages to the WebSocket
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const data of queue) {
      this.send(data);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.isDisposed = true;
    this.disconnect();
    this.messageQueue = [];
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();

      // Increase backoff delay for next attempt
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );
    }, this.reconnectDelay);
  }

  /**
   * Send a message to the renderer
   */
  private sendToRenderer(message: LoroMessage): void {
    try {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send('loro:adapter-event', message);
      }
    } catch (error) {
      log.error(
        `[LoroAdapter ${this.adapterId}] Error sending to renderer:`,
        error
      );
    }
  }
}
