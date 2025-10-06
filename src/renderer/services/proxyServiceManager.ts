/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Proxy ServiceManager implementation for Electron.
 * Routes HTTP and WebSocket traffic through IPC to bypass browser security restrictions.
 *
 * @module renderer/services/proxyServiceManager
 */

import { proxyLogger } from '../utils/logger';
import { loadServiceManager } from './serviceManagerLoader';
import {
  isBufferLike,
  isArrayBufferLike,
} from '../../shared/types/websocket.types';

/**
 * Custom fetch function that proxies HTTP requests through IPC.
 * Blocks requests to terminated runtimes to prevent errors.
 *
 * @param request - The request to proxy
 * @param init - Request initialization options
 * @returns Promise resolving to the HTTP response
 */
async function proxyFetch(
  request: RequestInfo,
  init?: RequestInit | null
): Promise<Response> {
  const r = new Request(request, init ?? undefined);

  // Check if this request is to a terminated runtime
  const url = r.url;
  if (url.includes('/api/kernels') || url.includes('/api/sessions')) {
    const cleanupRegistry = window.__datalayerRuntimeCleanup;
    if (cleanupRegistry) {
      // Extract runtime ID from URL to check if it's terminated
      const urlParts = url.split('/');
      const serverIndex = urlParts.findIndex(
        part => part.includes('python-cpu-pool') || part.includes('gpu-pool')
      );
      if (serverIndex !== -1 && serverIndex + 1 < urlParts.length) {
        const runtimeId = urlParts[serverIndex + 1];
        const entry = cleanupRegistry.get(runtimeId);
        if (entry?.terminated) {
          proxyLogger.debug(
            '🛑 [Request Blocked] Blocking request to terminated runtime:',
            runtimeId,
            url
          );
          // Return a fake empty response instead of making the actual request
          return new Response(JSON.stringify({ kernels: [], sessions: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
  }

  // Prepare request for IPC
  const method = r.method;
  const headers: Record<string, string> = {};
  r.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body: unknown;
  if (!['GET', 'HEAD'].includes(method)) {
    const contentType = headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      body = await r.text();
      try {
        body = JSON.parse(body as string);
      } catch {
        // Keep as string if not valid JSON
      }
    } else {
      body = await r.arrayBuffer();
    }
  }

  proxyLogger.debug(`HTTP ${method} ${url}`);

  // Send through IPC proxy
  const response = await window.proxyAPI.httpRequest({
    url,
    method,
    headers,
    body,
  });

  // Convert response body for Response constructor
  let responseBody: BodyInit | null = null;
  if (Array.isArray(response.body)) {
    // Convert array back to ArrayBuffer
    responseBody = new Uint8Array(response.body).buffer;
  } else if (response.body !== null && response.body !== undefined) {
    // Convert objects to JSON string, primitives to string
    if (typeof response.body === 'object') {
      responseBody = JSON.stringify(response.body);
    } else {
      responseBody = String(response.body);
    }
  }

  // Create Response object
  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Custom WebSocket class that proxies through IPC.
 * Implements the standard WebSocket API while routing traffic through
 * Electron's main process for secure communication.
 */
export class ProxyWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  private _readyState: number = ProxyWebSocket.CONNECTING;
  private _url: string;
  private _protocol: string;
  private _headers: Record<string, string> | undefined;
  private _runtimeId: string | undefined;
  private _id: string | null = null;
  private _eventListenerCleanup: (() => void) | null = null;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  bufferedAmount = 0;
  extensions = '';
  binaryType: BinaryType = 'blob';

  constructor(
    url: string | URL,
    protocols?: string | string[],
    headers?: Record<string, string>,
    runtimeId?: string
  ) {
    super();

    this._url = url.toString();
    this._headers = headers;
    this._runtimeId = runtimeId;

    // Handle protocol parameter
    if (typeof protocols === 'string') {
      this._protocol = protocols;
    } else if (Array.isArray(protocols) && protocols.length > 0) {
      // Filter out jupyter-specific protocol
      const filteredProtocols = protocols.filter(
        p => p !== 'v1.kernel.websocket.jupyter.org'
      );
      this._protocol = filteredProtocols[0] || '';
    } else {
      this._protocol = '';
    }

    this._open();
  }

  get readyState(): number {
    return this._readyState;
  }

  get url(): string {
    return this._url;
  }

  get protocol(): string {
    return this._protocol;
  }

  private async _open(): Promise<void> {
    try {
      // RACE CONDITION PREVENTION: Check if runtime is terminated before creating WebSocket connection
      if (this._runtimeId) {
        const cleanupRegistry = window.__datalayerRuntimeCleanup;
        if (cleanupRegistry && cleanupRegistry.has(this._runtimeId)) {
          const entry = cleanupRegistry.get(this._runtimeId);
          if (entry?.terminated) {
            proxyLogger.info(
              '[ProxyWebSocket] 🛑 RACE CONDITION PREVENTION: Blocking WebSocket connection for terminated runtime:',
              this._runtimeId
            );
            this._readyState = ProxyWebSocket.CLOSED;
            throw new Error(
              `Runtime ${this._runtimeId} has been terminated - no new WebSocket connections allowed`
            );
          }
        }
      }

      // Open connection through IPC
      const result = await window.proxyAPI.websocketOpen({
        url: this._url,
        protocol: this._protocol || undefined,
        headers: this._headers,
        runtimeId: this._runtimeId,
      });

      this._id = result.id;

      // Set up event listener for WebSocket events
      const eventHandler = (event: Record<string, unknown>) => {
        if (event.id !== this._id) {
          return;
        }

        // Only log non-message events to reduce noise
        if (event.type !== 'message') {
          proxyLogger.debug(`Event ${event.type} for ${this._id}`);
        }

        switch (event.type) {
          case 'open':
            this._readyState = ProxyWebSocket.OPEN;
            this.dispatchEvent(new Event('open'));
            if (this.onopen) {
              this.onopen(new Event('open'));
            }
            break;

          case 'message': {
            // Handle data conversion
            let messageData = event.data;

            // Convert Buffer representation back to proper format for JupyterLab
            if (isBufferLike(messageData)) {
              // First check if this is actually a JSON message incorrectly sent as Buffer
              const bufferData = messageData as { data: number[] };
              try {
                const str = String.fromCharCode(...bufferData.data);
                JSON.parse(str); // Just validate it's JSON
                messageData = str; // Send as string instead of binary
              } catch (jsonError) {
                // Not JSON, handle as actual binary data (likely heartbeat)
                try {
                  // Create ArrayBuffer with proper size and copy data
                  const buffer = new ArrayBuffer(bufferData.data.length);
                  const uint8View = new Uint8Array(buffer);

                  // Copy each byte individually to ensure correct transfer
                  for (let i = 0; i < bufferData.data.length; i++) {
                    uint8View[i] = bufferData.data[i] & 0xff; // Ensure it's a valid byte
                  }

                  messageData = buffer;
                } catch (error) {
                  proxyLogger.error(`Error converting Buffer:`, error);
                  // Fallback to original behavior
                  messageData = new Uint8Array(bufferData.data).buffer;
                }
              }
            } else if (isArrayBufferLike(messageData)) {
              const arrayData = messageData as { data: number[] };
              try {
                const buffer = new ArrayBuffer(arrayData.data.length);
                const uint8View = new Uint8Array(buffer);
                for (let i = 0; i < arrayData.data.length; i++) {
                  uint8View[i] = arrayData.data[i] & 0xff;
                }
                messageData = buffer;
              } catch (error) {
                proxyLogger.error(`Error converting ArrayBuffer:`, error);
                messageData = new Uint8Array(arrayData.data).buffer;
              }
            }

            const messageEvent = new MessageEvent('message', {
              data: messageData,
            });
            this.dispatchEvent(messageEvent);
            if (this.onmessage) {
              this.onmessage(messageEvent);
            }
            break;
          }

          case 'close': {
            this._readyState = ProxyWebSocket.CLOSED;
            const closeEvent = new CloseEvent('close', {
              code: (event.code as number | undefined) ?? 1000,
              reason: (event.reason as string | undefined) ?? '',
              wasClean: true,
            });
            this.dispatchEvent(closeEvent);
            if (this.onclose) {
              this.onclose(closeEvent);
            }
            this._cleanup();
            break;
          }

          case 'error': {
            const errorEvent = new Event('error');
            this.dispatchEvent(errorEvent);
            if (this.onerror) {
              this.onerror(errorEvent);
            }
            break;
          }
        }
      };

      window.proxyAPI.onWebSocketEvent(eventHandler);

      // Store cleanup function
      this._eventListenerCleanup = () => {
        window.proxyAPI.removeWebSocketEventListener();
      };
    } catch (error) {
      // Only log as error if it's not a terminated runtime error
      const errorStr = String(error);
      if (
        errorStr.includes('terminated') ||
        errorStr.includes('no new connections allowed')
      ) {
        proxyLogger.debug('Connection blocked (runtime terminated):', error);
      } else {
        proxyLogger.error('Failed to open connection:', error);
      }
      this._readyState = ProxyWebSocket.CLOSED;

      const errorEvent = new Event('error');
      this.dispatchEvent(errorEvent);
      if (this.onerror) {
        this.onerror(errorEvent);
      }
    }
  }

  send(data: unknown): void {
    if (this._readyState !== ProxyWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    if (!this._id) {
      throw new Error('WebSocket connection ID not available');
    }

    // Convert data for transmission
    let sendData = data;
    if (data instanceof ArrayBuffer) {
      // Convert ArrayBuffer to array for IPC
      sendData = {
        type: 'Buffer',
        data: Array.from(new Uint8Array(data)),
      };
    } else if (data instanceof Uint8Array) {
      // Handle Uint8Array
      sendData = {
        type: 'Buffer',
        data: Array.from(data),
      };
    } else if (typeof data === 'object') {
      sendData = JSON.stringify(data);
    }

    window.proxyAPI.websocketSend({
      id: this._id,
      data: sendData,
    });
  }

  close(code?: number, reason?: string): void {
    if (
      this._readyState === ProxyWebSocket.CLOSING ||
      this._readyState === ProxyWebSocket.CLOSED
    ) {
      return;
    }

    this._readyState = ProxyWebSocket.CLOSING;

    if (this._id) {
      proxyLogger.debug(`Closing connection ${this._id}`);
      window.proxyAPI.websocketClose({
        id: this._id,
        code,
        reason,
      });
    }

    this._cleanup();
  }

  private _cleanup(): void {
    if (this._eventListenerCleanup) {
      this._eventListenerCleanup();
      this._eventListenerCleanup = null;
    }
  }

  // Event handler properties
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

/**
 * Create a ServiceManager instance that uses proxy connections.
 * All HTTP and WebSocket traffic will be routed through IPC.
 *
 * @param baseUrl - The base URL for the Jupyter server
 * @param token - Authentication token for the server
 * @param runtimeId - Optional runtime identifier for connection tracking
 * @returns Promise resolving to a configured ServiceManager instance
 */
export async function createProxyServiceManager(
  baseUrl: string,
  token: string = '',
  runtimeId?: string
) {
  // Normalize baseUrl to avoid double slashes - ensure it ends with exactly one slash
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '') + '/';

  proxyLogger.debug(`Creating ServiceManager with baseUrl: ${baseUrl}`);
  proxyLogger.debug(`Normalized baseUrl: ${normalizedBaseUrl}`);

  // Load the real ServiceManager and ServerConnection at runtime
  const { ServiceManager, ServerConnection } = await loadServiceManager();

  // Create a WebSocket factory that includes runtime ID
  const WebSocketFactory = class extends ProxyWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols, undefined, runtimeId);
    }
  };

  const settings = (
    (ServerConnection as Record<string, unknown>).makeSettings as (
      ...args: unknown[]
    ) => unknown
  )({
    baseUrl: normalizedBaseUrl,
    token,
    appUrl: '',
    wsUrl: normalizedBaseUrl.replace(/^https?/, 'wss'),
    init: {
      cache: 'no-store' as RequestCache,
    },
    fetch: proxyFetch,
    WebSocket: WebSocketFactory as typeof WebSocket,
    appendToken: true,
  });

  return new (ServiceManager as unknown as new (
    ...args: unknown[]
  ) => Record<string, unknown>)({
    serverSettings: settings,
  }) as unknown as import('@jupyterlab/services').ServiceManager.IManager;
}
