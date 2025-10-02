/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Mock implementations for WebSocket APIs used in tests.
 * Provides mock WebSocket connections and proxy APIs.
 *
 * @module tests/mocks/websocket
 */

import { vi } from 'vitest';

/**
 * Mock WebSocket class for browser environment.
 */
export class MockWebSocket {
  public readyState: number = MockWebSocket.CONNECTING;
  public url: string;
  public protocol: string;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';

    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Echo back the message for testing
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data }));
      }
    }, 0);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(
          new CloseEvent('close', {
            code: code || 1000,
            reason: reason || '',
            wasClean: true,
          })
        );
      }
    }, 0);
  }

  addEventListener(type: string, listener: EventListener) {
    switch (type) {
      case 'open':
        this.onopen = listener as any;
        break;
      case 'close':
        this.onclose = listener as any;
        break;
      case 'error':
        this.onerror = listener as any;
        break;
      case 'message':
        this.onmessage = listener as any;
        break;
    }
  }

  removeEventListener(type: string, listener: EventListener) {
    switch (type) {
      case 'open':
        if (this.onopen === listener) this.onopen = null;
        break;
      case 'close':
        if (this.onclose === listener) this.onclose = null;
        break;
      case 'error':
        if (this.onerror === listener) this.onerror = null;
        break;
      case 'message':
        if (this.onmessage === listener) this.onmessage = null;
        break;
    }
  }
}

/**
 * Mock Proxy API for WebSocket connections (window.proxyAPI).
 */
export const mockProxyAPI = {
  websocketOpen: vi.fn((config: any) =>
    Promise.resolve({
      id: `ws-${Math.random().toString(36).substring(7)}`,
    })
  ),
  websocketSend: vi.fn((id: string, data: any) =>
    Promise.resolve({
      success: true,
    })
  ),
  websocketClose: vi.fn((id: string, code?: number, reason?: string) =>
    Promise.resolve({
      success: true,
    })
  ),
  websocketCloseRuntime: vi.fn((runtimeId: string) =>
    Promise.resolve({
      success: true,
    })
  ),

  // HTTP proxy
  httpRequest: vi.fn((config: any) =>
    Promise.resolve({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: {},
    })
  ),
};

/**
 * Mock Electron API (window.electronAPI).
 */
export const mockElectronAPI = {
  getVersion: vi.fn(() =>
    Promise.resolve({
      electron: '34.5.8',
      node: '20.18.0',
      chrome: '130.0.6723.59',
      app: '0.0.1',
    })
  ),
  getEnv: vi.fn(() =>
    Promise.resolve({
      DATALAYER_RUN_URL: 'https://prod1.datalayer.run',
      DATALAYER_TOKEN: '',
    })
  ),
  openExternal: vi.fn((url: string) => Promise.resolve()),
  notifyRuntimeTerminated: vi.fn((runtimeId: string) =>
    Promise.resolve({
      success: true,
    })
  ),
  showNotification: vi.fn((options: any) => {}),
};

/**
 * Setup WebSocket mocks.
 */
export function setupWebSocketMocks() {
  (global as any).WebSocket = MockWebSocket;
  (global as any).window = {
    ...(global as any).window,
    proxyAPI: mockProxyAPI,
    electronAPI: mockElectronAPI,
  };
}

/**
 * Reset all WebSocket mocks.
 */
export function resetWebSocketMocks() {
  Object.values(mockProxyAPI).forEach((mock: any) => {
    if (vi.isMockFunction(mock)) {
      mock.mockClear();
    }
  });

  Object.values(mockElectronAPI).forEach((mock: any) => {
    if (vi.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}
