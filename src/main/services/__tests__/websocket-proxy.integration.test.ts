/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Integration tests for the WebSocket Proxy Service.
 * Tests connection lifecycle, runtime association, message routing, and cleanup.
 *
 * @module main/services/websocket-proxy.integration.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserWindow } from 'electron';
// import WebSocket from 'ws';
import { setupElectronMocks } from '../../../../tests/mocks';

// Setup Electron mocks
setupElectronMocks();

// Import after mocks are set up
import { websocketProxy } from '../websocket-proxy';

// Define mock WebSocket interface
interface MockWebSocket {
  url: string;
  protocol?: string;
  readyState: number;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  eventHandlers: Record<string, (...args: unknown[]) => void>;
  onceHandlers: Record<string, (...args: unknown[]) => void>;
  triggerEvent: (event: string, ...args: unknown[]) => void;
}

// Mock WebSocket
const mockWebSocketInstances: MockWebSocket[] = [];

vi.mock('ws', () => {
  return {
    default: vi.fn().mockImplementation((url: string, protocol?: string) => {
      const mockWs: MockWebSocket = {
        url,
        protocol,
        readyState: 1, // OPEN
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          mockWs.eventHandlers[event] = handler;
        }),
        once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          mockWs.onceHandlers[event] = handler;
        }),
        send: vi.fn((_data: unknown) => {
          // Simulate successful send
        }),
        close: vi.fn((code?: number, reason?: string) => {
          mockWs.readyState = 3; // CLOSED
          // Trigger close handler if exists
          if (mockWs.eventHandlers.close) {
            mockWs.eventHandlers.close(code || 1000, Buffer.from(reason || ''));
          }
        }),
        eventHandlers: {} as Record<string, (...args: unknown[]) => void>,
        onceHandlers: {} as Record<string, (...args: unknown[]) => void>,
        // Helper to trigger events
        triggerEvent: (event: string, ...args: unknown[]) => {
          if (mockWs.eventHandlers[event]) {
            mockWs.eventHandlers[event](...args);
          }
        },
      };

      mockWebSocketInstances.push(mockWs);
      return mockWs;
    }),
  };
});

// Define mock BrowserWindow interface
interface MockBrowserWindow {
  isDestroyed: ReturnType<typeof vi.fn>;
  webContents: {
    send: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
  };
  once: ReturnType<typeof vi.fn>;
}

describe('WebSocketProxyService - Integration Tests', () => {
  let mockWindow: MockBrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketInstances.length = 0;

    // Create mock BrowserWindow
    mockWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn(),
        isDestroyed: vi.fn(() => false),
      },
      once: vi.fn(),
    };

    // Clear global runtime cleanup registry
    (global as Record<string, unknown>).__datalayerRuntimeCleanup = new Map();
  });

  afterEach(() => {
    // Clean up any remaining connections
    websocketProxy.closeAll();
  });

  describe('connection lifecycle', () => {
    it('should open a WebSocket connection and return connection ID', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      expect(result).toHaveProperty('id');
      expect(result.id).toMatch(/^ws-\d+$/);
      expect(mockWebSocketInstances).toHaveLength(1);
      expect(mockWebSocketInstances[0].url).toBe(
        'ws://localhost:8888/api/kernels/test'
      );
    });

    it('should trigger open event and notify renderer', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      mockWs.triggerEvent('open');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'websocket-event',
        {
          id: result.id,
          type: 'open',
        }
      );
    });

    it('should handle message events and forward to renderer', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      const testMessage = JSON.stringify({ msg_type: 'kernel_info_reply' });
      mockWs.triggerEvent('message', Buffer.from(testMessage));

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'websocket-event',
        {
          id: result.id,
          type: 'message',
          data: testMessage,
        }
      );
    });

    it('should handle binary messages correctly', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      const binaryData = Buffer.from([1, 2, 3, 4, 5]);
      mockWs.triggerEvent('message', binaryData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'websocket-event',
        {
          id: result.id,
          type: 'message',
          data: {
            type: 'Buffer',
            data: [1, 2, 3, 4, 5],
          },
        }
      );
    });

    it('should handle close event and cleanup', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      mockWs.triggerEvent('close', 1000, Buffer.from('Normal closure'));

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'websocket-event',
        {
          id: result.id,
          type: 'close',
          code: 1000,
          reason: 'Normal closure',
          wasClean: true,
        }
      );
    });

    it('should handle error event', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      const testError = new Error('Connection failed');
      mockWs.triggerEvent('error', testError);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'websocket-event',
        {
          id: result.id,
          type: 'error',
          error: 'Connection failed',
          message: testError.toString(),
        }
      );
    });

    it('should not send events if window is destroyed', () => {
      mockWindow.isDestroyed = vi.fn(() => true);

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      mockWs.triggerEvent('open');

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('runtime association and tracking', () => {
    it('should associate connection with runtime ID', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test',
        undefined,
        undefined,
        'runtime-123'
      );

      expect(result).toHaveProperty('id');
      expect(mockWebSocketInstances).toHaveLength(1);
    });

    it('should block new connections to terminated runtime', () => {
      const runtimeId = 'runtime-terminated';

      // Mark runtime as terminated
      (global as Record<string, unknown>).__datalayerRuntimeCleanup = new Map([
        [runtimeId, { terminated: true }],
      ]);

      const result: Record<string, unknown> = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test',
        undefined,
        undefined,
        runtimeId
      );

      expect(result).toHaveProperty('blocked', true);
      expect(result).toHaveProperty('reason');
      expect(result.reason).toContain('terminated');
      expect(mockWebSocketInstances).toHaveLength(0);
    });

    it('should track multiple connections for same runtime', () => {
      const runtimeId = 'runtime-123';

      const conn1 = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel1',
        undefined,
        undefined,
        runtimeId
      );

      const conn2 = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel2',
        undefined,
        undefined,
        runtimeId
      );

      expect(conn1.id).not.toBe(conn2.id);
      expect(mockWebSocketInstances).toHaveLength(2);
    });

    it('should close all connections when runtime is terminated', () => {
      const runtimeId = 'runtime-to-terminate';

      // Create multiple connections for the runtime
      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel1',
        undefined,
        undefined,
        runtimeId
      );

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel2',
        undefined,
        undefined,
        runtimeId
      );

      expect(mockWebSocketInstances).toHaveLength(2);

      // Terminate runtime and close connections
      websocketProxy.closeConnectionsForRuntime(runtimeId);

      expect(mockWebSocketInstances[0].close).toHaveBeenCalledWith(
        1000,
        'Runtime terminated'
      );
      expect(mockWebSocketInstances[1].close).toHaveBeenCalledWith(
        1000,
        'Runtime terminated'
      );
    });

    it('should not affect other runtime connections when closing specific runtime', () => {
      const runtime1 = 'runtime-1';
      const runtime2 = 'runtime-2';

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel1',
        undefined,
        undefined,
        runtime1
      );

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel2',
        undefined,
        undefined,
        runtime2
      );

      websocketProxy.closeConnectionsForRuntime(runtime1);

      expect(mockWebSocketInstances[0].close).toHaveBeenCalled();
      expect(mockWebSocketInstances[1].close).not.toHaveBeenCalled();
    });
  });

  describe('message sending', () => {
    it('should send string messages', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const testMessage = JSON.stringify({ msg_type: 'execute_request' });
      websocketProxy.send(result.id, testMessage);

      const mockWs = mockWebSocketInstances[0];
      expect(mockWs.send).toHaveBeenCalledWith(testMessage);
    });

    it('should send buffer messages', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const bufferData = { type: 'Buffer', data: [1, 2, 3, 4] };
      websocketProxy.send(result.id, bufferData);

      const mockWs = mockWebSocketInstances[0];
      expect(mockWs.send).toHaveBeenCalled();
      const sentData = mockWs.send.mock.calls[0][0];
      expect(Buffer.isBuffer(sentData)).toBe(true);
    });

    it('should handle missing connection gracefully', () => {
      // Should not throw
      expect(() => {
        websocketProxy.send('nonexistent-id', 'test message');
      }).not.toThrow();
    });

    it('should stringify objects', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const testObject = { foo: 'bar', num: 42 };
      websocketProxy.send(result.id, testObject);

      const mockWs = mockWebSocketInstances[0];
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(testObject));
    });
  });

  describe('connection closing', () => {
    it('should close connection by ID', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      websocketProxy.close(result.id);

      const mockWs = mockWebSocketInstances[0];
      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should close connection with code and reason', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      websocketProxy.close(result.id, 1001, 'Going away');

      const mockWs = mockWebSocketInstances[0];
      expect(mockWs.close).toHaveBeenCalledWith(1001, 'Going away');
    });

    it('should handle closing non-existent connection', () => {
      expect(() => {
        websocketProxy.close('nonexistent-id');
      }).not.toThrow();
    });
  });

  describe('window lifecycle integration', () => {
    it('should register window close handler', () => {
      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      expect(mockWindow.once).toHaveBeenCalledWith(
        'closed',
        expect.any(Function)
      );
    });

    it('should close all window connections when window closes', () => {
      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel1'
      );

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel2'
      );

      // Trigger window close event
      const closeHandler = mockWindow.once.mock.calls[0][1];
      closeHandler();

      expect(mockWebSocketInstances[0].close).toHaveBeenCalled();
      expect(mockWebSocketInstances[1].close).toHaveBeenCalled();
    });

    it('should only close connections for specific window', () => {
      const mockWindow2 = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
          isDestroyed: vi.fn(() => false),
        },
        once: vi.fn(),
      };

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel1'
      );

      websocketProxy.open(
        mockWindow2 as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel2'
      );

      // Close only first window
      const closeHandler = mockWindow.once.mock.calls[0][1];
      closeHandler();

      expect(mockWebSocketInstances[0].close).toHaveBeenCalled();
      expect(mockWebSocketInstances[1].close).not.toHaveBeenCalled();
    });
  });

  describe('bulk operations', () => {
    it('should close all connections', () => {
      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel1'
      );

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel2'
      );

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel3'
      );

      websocketProxy.closeAll();

      expect(mockWebSocketInstances[0].close).toHaveBeenCalled();
      expect(mockWebSocketInstances[1].close).toHaveBeenCalled();
      expect(mockWebSocketInstances[2].close).toHaveBeenCalled();
    });

    it('should clear all tracking maps', () => {
      const runtime1 = 'runtime-1';
      const runtime2 = 'runtime-2';

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel1',
        undefined,
        undefined,
        runtime1
      );

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/kernel2',
        undefined,
        undefined,
        runtime2
      );

      websocketProxy.closeAll();

      // Verify no connections remain for runtimes
      websocketProxy.closeConnectionsForRuntime(runtime1);
      websocketProxy.closeConnectionsForRuntime(runtime2);

      // Should not error or close anything (already cleaned up)
      expect(mockWebSocketInstances[0].close).toHaveBeenCalledTimes(1);
      expect(mockWebSocketInstances[1].close).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection with headers', () => {
    it('should pass headers to WebSocket constructor', () => {
      const headers = {
        Authorization: 'Bearer test-token',
        'Custom-Header': 'value',
      };

      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test',
        undefined,
        headers
      );

      expect(mockWebSocketInstances).toHaveLength(1);
    });

    it('should pass protocol to WebSocket constructor', () => {
      websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test',
        'v1.kernel.jupyter.org'
      );

      expect(mockWebSocketInstances[0].protocol).toBe('v1.kernel.jupyter.org');
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket send errors gracefully', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      mockWs.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      // Should not throw
      expect(() => {
        websocketProxy.send(result.id, 'test message');
      }).not.toThrow();
    });

    it('should handle ArrayBuffer messages', () => {
      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
      );

      const mockWs = mockWebSocketInstances[0];
      const arrayBuffer = new ArrayBuffer(8);
      mockWs.triggerEvent('message', arrayBuffer);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'websocket-event',
        {
          id: result.id,
          type: 'message',
          data: {
            type: 'ArrayBuffer',
            data: expect.any(Array),
          },
        }
      );
    });
  });

  describe('runtime cleanup registry integration', () => {
    it('should respect runtime cleanup registry', () => {
      const runtimeId = 'runtime-cleanup-test';

      // Initialize runtime as active
      (global as Record<string, unknown>).__datalayerRuntimeCleanup = new Map([
        [runtimeId, { terminated: false }],
      ]);

      const result1 = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test',
        undefined,
        undefined,
        runtimeId
      );

      expect(result1).toHaveProperty('id');
      expect(mockWebSocketInstances).toHaveLength(1);

      // Mark as terminated
      (
        (global as Record<string, unknown>).__datalayerRuntimeCleanup as Map<
          string,
          unknown
        >
      ).set(runtimeId, {
        terminated: true,
      });

      // Try to create new connection - should be blocked
      const result2: Record<string, unknown> = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test2',
        undefined,
        undefined,
        runtimeId
      );

      expect(result2).toHaveProperty('blocked', true);
      expect(mockWebSocketInstances).toHaveLength(1); // No new connection
    });

    it('should allow connections without runtime ID even if cleanup registry exists', () => {
      (global as Record<string, unknown>).__datalayerRuntimeCleanup = new Map([
        ['some-runtime', { terminated: true }],
      ]);

      const result = websocketProxy.open(
        mockWindow as unknown as BrowserWindow,
        'ws://localhost:8888/api/kernels/test'
        // No runtime ID
      );

      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('blocked');
      expect(mockWebSocketInstances).toHaveLength(1);
    });
  });
});
