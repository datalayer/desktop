/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the runtime store - complex state management for compute runtimes.
 *
 * @module renderer/stores/runtimeStore.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRuntimeStore } from './runtimeStore';
import { mockRuntimes, mockNotebooks } from '../../../tests/fixtures';

// Mock ServiceManager
const mockServiceManager = {
  sessions: {
    refreshRunning: vi.fn().mockResolvedValue(undefined),
    running: vi.fn().mockReturnValue([]),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
  kernels: {
    refreshRunning: vi.fn().mockResolvedValue(undefined),
    running: vi.fn().mockReturnValue([]),
    shutdown: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
  },
  dispose: vi.fn(),
  isDisposed: false,
};

// Mock window APIs
const mockDatalayerAPI = {
  getCredentials: vi.fn().mockResolvedValue({
    runUrl: 'https://prod1.datalayer.run',
    token: 'mock-token',
    isAuthenticated: true,
  }),
  createRuntime: vi.fn(),
  deleteRuntime: vi.fn().mockResolvedValue({ success: true }),
  isRuntimeActive: vi.fn(),
  listRuntimes: vi.fn().mockResolvedValue({ success: true, data: mockRuntimes }),
};

const mockDatalayerClient = {
  listRuntimes: vi.fn().mockResolvedValue(mockRuntimes),
};

const mockProxyAPI = {
  websocketCloseRuntime: vi.fn().mockResolvedValue({ success: true }),
};

const mockElectronAPI = {
  notifyRuntimeTerminated: vi.fn().mockResolvedValue({ success: true }),
  showNotification: vi.fn(),
};

beforeEach(() => {
  // Fix happy-dom DOM API issues for React 18
  // React DOM checks instanceof on activeElement and Selection during rendering
  if (!document.activeElement || !(document.activeElement instanceof Node)) {
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      writable: true,
      value: document.body,
    });
  }

  // Mock getSelection for React DOM
  if (!window.getSelection) {
    (window as any).getSelection = () => ({
      rangeCount: 0,
      addRange: vi.fn(),
      removeAllRanges: vi.fn(),
    });
  }

  // Clear all globals
  delete (globalThis as any).__datalayerRuntimeCleanup;
  delete (globalThis as any).__runtimeCreationPromises;

  // Setup window mocks
  (global as any).window = {
    datalayerAPI: mockDatalayerAPI,
    datalayerClient: mockDatalayerClient,
    proxyAPI: mockProxyAPI,
    electronAPI: mockElectronAPI,
    location: {
      reload: vi.fn(),
    },
    dispatchEvent: vi.fn(),
  };

  // Clear session storage
  sessionStorage.clear();

  // Reset all mocks
  vi.clearAllMocks();

  // Reset mock implementations
  mockDatalayerClient.listRuntimes.mockResolvedValue(mockRuntimes);

  // Default successful runtime creation
  mockDatalayerAPI.createRuntime.mockResolvedValue({
    success: true,
    data: { runtime: mockRuntimes[0] },
  });

  // Store state will be reset in individual tests as needed
});

afterEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();

  // Re-set mock implementations after reset
  mockDatalayerClient.listRuntimes.mockResolvedValue(mockRuntimes);
  mockDatalayerAPI.createRuntime.mockResolvedValue({
    success: true,
    data: { runtime: mockRuntimes[0] },
  });
  mockDatalayerAPI.deleteRuntime.mockResolvedValue({ success: true });

  // Clean up global state directly without rendering
  if (globalThis.__runtimeCreationPromises) {
    globalThis.__runtimeCreationPromises.clear();
  }
  if (globalThis.__datalayerRuntimeCleanup) {
    globalThis.__datalayerRuntimeCleanup.clear();
  }

  // Clear all timers before resetting store
  const store = useRuntimeStore.getState();
  if (store.clearAllExpirationTimers) {
    store.clearAllExpirationTimers();
  }

  // Reset Zustand store state directly (merges with existing state, preserves methods)
  useRuntimeStore.setState({
    notebookRuntimes: new Map(),
    activeNotebookId: null,
    allRuntimes: [],
    lastRuntimesFetch: null,
    expirationTimers: new Map(),
    isCreatingRuntime: false,
    isTerminatingRuntime: false,
    runtimeError: null,
  });
});

describe('runtimeStore', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      // Access store state directly without rendering
      const state = useRuntimeStore.getState();

      expect(state.notebookRuntimes).toBeInstanceOf(Map);
      expect(state.notebookRuntimes.size).toBe(0);
      expect(state.activeNotebookId).toBeNull();
      expect(state.allRuntimes).toEqual([]);
      expect(state.isCreatingRuntime).toBe(false);
      expect(state.isTerminatingRuntime).toBe(false);
      expect(state.runtimeError).toBeNull();
    });
  });

  describe('createRuntimeForNotebook', () => {
    it('should create runtime for notebook', async () => {
      const store = useRuntimeStore.getState();

      const runtime = await store.createRuntimeForNotebook('notebook-1', '/path/to/nb');

      expect(runtime).toEqual(mockRuntimes[0]);
      expect(useRuntimeStore.getState().notebookRuntimes.has('notebook-1')).toBe(true);
      expect(mockDatalayerAPI.createRuntime).toHaveBeenCalledTimes(1);
    });

    it('should return existing runtime if already created', async () => {
      const store = useRuntimeStore.getState();

      // Create runtime first time
      const runtime1 = await store.createRuntimeForNotebook('notebook-1');

      // Try to create again - should return existing
      const runtime2 = await useRuntimeStore.getState().createRuntimeForNotebook('notebook-1');

      expect(runtime1).toEqual(runtime2);
      expect(mockDatalayerAPI.createRuntime).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should use unique timestamp in runtime name', async () => {
      const store = useRuntimeStore.getState();

      await store.createRuntimeForNotebook('notebook-1');

      const createCall = mockDatalayerAPI.createRuntime.mock.calls[0][0];
      expect(createCall.name).toMatch(/electron-example-notebook-1-\w+/);
    });

    it('should save runtime to storage after creation', async () => {
      const store = useRuntimeStore.getState();

      await store.createRuntimeForNotebook('notebook-1', '/path');

      const stored = sessionStorage.getItem('datalayer-runtimes');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].notebookId).toBe('notebook-1');
    });
  });

  describe('terminateRuntimeForNotebook', () => {
    beforeEach(async () => {
      // Re-initialize mock service manager methods (they get cleared by vi.resetAllMocks in afterEach)
      mockServiceManager.sessions.refreshRunning = vi.fn().mockResolvedValue(undefined);
      mockServiceManager.sessions.running = vi.fn().mockReturnValue([]);
      mockServiceManager.sessions.shutdown = vi.fn().mockResolvedValue(undefined);
      mockServiceManager.kernels.refreshRunning = vi.fn().mockResolvedValue(undefined);
      mockServiceManager.kernels.running = vi.fn().mockReturnValue([]);
      mockServiceManager.kernels.shutdown = vi.fn().mockResolvedValue(undefined);

      // Create a runtime first
      const store = useRuntimeStore.getState();
      await store.createRuntimeForNotebook('notebook-1');
      // Add mock service manager
      useRuntimeStore.getState().setServiceManagerForNotebook('notebook-1', mockServiceManager as any);
    });

    it('should terminate runtime and clean up resources', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      expect(useRuntimeStore.getState().notebookRuntimes.has('notebook-1')).toBe(false);
      expect(mockDatalayerAPI.deleteRuntime).toHaveBeenCalled();
    });

    it('should shut down sessions and kernels before terminating', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      expect(mockServiceManager.sessions.refreshRunning).toHaveBeenCalled();
      expect(mockServiceManager.kernels.refreshRunning).toHaveBeenCalled();
    });

    it('should close websocket connections for runtime', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      expect(mockProxyAPI.websocketCloseRuntime).toHaveBeenCalledWith({
        runtimeId: mockRuntimes[0].uid,
      });
    });

    it('should notify main process about termination', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      expect(mockElectronAPI.notifyRuntimeTerminated).toHaveBeenCalledWith(
        mockRuntimes[0].uid
      );
    });

    it('should dispatch collaboration cleanup event', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'runtime-collaboration-cleanup',
        })
      );
    });

    it('should mark runtime as terminated in global registry', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      const registry = (window as any).__datalayerRuntimeCleanup;
      expect(registry).toBeDefined();
      expect(registry.has(mockRuntimes[0].uid)).toBe(true);
      expect(registry.get(mockRuntimes[0].uid).terminated).toBe(true);
    });

    it('should clear cached creation promise', async () => {
      const store = useRuntimeStore.getState();

      // Set a cached promise
      (globalThis as any).__runtimeCreationPromises = new Map();
      (globalThis as any).__runtimeCreationPromises.set('notebook-1', Promise.resolve(null));

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      expect((globalThis as any).__runtimeCreationPromises.has('notebook-1')).toBe(false);
    });

    it('should handle termination when no runtime exists', async () => {
      const store = useRuntimeStore.getState();

      // Clear the runtime we created in beforeEach
        useRuntimeStore.getState().notebookRuntimes.clear();

        // Should not throw
        await useRuntimeStore.getState().terminateRuntimeForNotebook('nonexistent');

      expect(mockDatalayerAPI.deleteRuntime).not.toHaveBeenCalled();
    });

    it('should clear active notebook if terminating active runtime', async () => {
      const store = useRuntimeStore.getState();

      useRuntimeStore.getState().setActiveNotebook('notebook-1');

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      expect(useRuntimeStore.getState().activeNotebookId).toBeNull();
    });

    it('should update storage after termination', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().terminateRuntimeForNotebook('notebook-1');

      const stored = sessionStorage.getItem('datalayer-runtimes');
      expect(stored).toBe('[]');
    });
  });

  describe('helper getters', () => {
    it('should get current runtime for active notebook', async () => {
      const store = useRuntimeStore.getState();

      await store.createRuntimeForNotebook('notebook-1');
        useRuntimeStore.getState().setActiveNotebook('notebook-1');

      const runtime = useRuntimeStore.getState().getCurrentRuntime();
      expect(runtime).toEqual(mockRuntimes[0]);
    });

    it('should return null when no active notebook', () => {
      const store = useRuntimeStore.getState();

      const runtime = useRuntimeStore.getState().getCurrentRuntime();
      expect(runtime).toBeNull();
    });

    it('should get service manager for active notebook', async () => {
      const store = useRuntimeStore.getState();

      await store.createRuntimeForNotebook('notebook-1');
        useRuntimeStore.getState().setActiveNotebook('notebook-1');
        useRuntimeStore.getState().setServiceManagerForNotebook('notebook-1', mockServiceManager as any);

      const manager = useRuntimeStore.getState().getCurrentServiceManager();
      expect(manager).toBe(mockServiceManager);
    });

    it('should check if has active runtime', async () => {
      const store = useRuntimeStore.getState();

      expect(useRuntimeStore.getState().hasActiveRuntime()).toBe(false);

      await store.createRuntimeForNotebook('notebook-1');

      expect(useRuntimeStore.getState().hasActiveRuntime()).toBe(true);
    });
  });

  describe('global runtime management', () => {
    it('should fetch all runtimes from platform', async () => {
      const store = useRuntimeStore.getState();

      const runtimes = await useRuntimeStore.getState().fetchAllRuntimes();
        expect(runtimes).toEqual(mockRuntimes);

      expect(mockDatalayerClient.listRuntimes).toHaveBeenCalled();
      expect(useRuntimeStore.getState().allRuntimes).toEqual(mockRuntimes);
    });

    it('should cache runtime list with timestamp', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().fetchAllRuntimes();

      expect(useRuntimeStore.getState().lastRuntimesFetch).not.toBeNull();
      expect(typeof useRuntimeStore.getState().lastRuntimesFetch).toBe('number');
    });

    it('should refresh runtimes if cache is stale', async () => {
      const store = useRuntimeStore.getState();

      // First fetch
      await useRuntimeStore.getState().fetchAllRuntimes();

      expect(mockDatalayerClient.listRuntimes).toHaveBeenCalledTimes(1);

      // Set stale timestamp (>30s ago)
      useRuntimeStore.setState({ lastRuntimesFetch: Date.now() - 35000 });

      // Refresh should fetch again
      await useRuntimeStore.getState().refreshRuntimes();

      expect(mockDatalayerClient.listRuntimes).toHaveBeenCalledTimes(2);
    });

    it('should not refresh runtimes if cache is fresh', async () => {
      const store = useRuntimeStore.getState();

      await useRuntimeStore.getState().fetchAllRuntimes();

      expect(mockDatalayerClient.listRuntimes).toHaveBeenCalledTimes(1);

      // Cache is fresh (<30s)
      await useRuntimeStore.getState().refreshRuntimes();

      expect(mockDatalayerClient.listRuntimes).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should select existing runtime for notebook', async () => {
      const store = useRuntimeStore.getState();

      // Use runtime with future expiration to avoid immediate expiry
      const futureRuntime = {
        ...mockRuntimes[0],
        expired_at: (Date.now() / 1000 + 3600).toString(),
      };

      await useRuntimeStore.getState().selectRuntimeForNotebook('notebook-1', futureRuntime);

      expect(useRuntimeStore.getState().notebookRuntimes.has('notebook-1')).toBe(true);
      expect(useRuntimeStore.getState().activeNotebookId).toBe('notebook-1');
    });
  });

  describe('expiration timer management', () => {
    it('should start expiration timer for runtime', async () => {
      const store = useRuntimeStore.getState();

      // Create runtime with future expiration
      const futureRuntime = {
        ...mockRuntimes[0],
        expired_at: (Date.now() / 1000 + 3600).toString(), // Expires 1 hour from now
      };

      useRuntimeStore.getState().startExpirationTimer(futureRuntime);

      expect(useRuntimeStore.getState().expirationTimers.has(futureRuntime.uid)).toBe(true);
    });

    it('should handle already expired runtimes', async () => {
      const store = useRuntimeStore.getState();

      const expiredRuntime = {
        ...mockRuntimes[0],
        expired_at: (Date.now() / 1000 - 3600).toString(), // Expired 1 hour ago
      };

        useRuntimeStore.getState().allRuntimes = [expiredRuntime];
        useRuntimeStore.getState().startExpirationTimer(expiredRuntime);

      // Should immediately trigger expiration handler
      expect(useRuntimeStore.getState().allRuntimes.find(r => r.uid === expiredRuntime.uid)).toBeUndefined();
    });

    it('should clear all expiration timers', async () => {
      const store = useRuntimeStore.getState();

      // Create runtimes with future expiration
      const futureRuntime1 = {
        ...mockRuntimes[0],
        expired_at: (Date.now() / 1000 + 3600).toString(),
      };
      const futureRuntime2 = {
        ...mockRuntimes[1],
        expired_at: (Date.now() / 1000 + 3600).toString(),
      };

      useRuntimeStore.getState().startExpirationTimer(futureRuntime1);
      useRuntimeStore.getState().startExpirationTimer(futureRuntime2);

      expect(useRuntimeStore.getState().expirationTimers.size).toBe(2);

      store.clearAllExpirationTimers();

      expect(useRuntimeStore.getState().expirationTimers.size).toBe(0);
    });

    it('should show notification when runtime expires', async () => {
      const store = useRuntimeStore.getState();

        useRuntimeStore.getState().allRuntimes = [mockRuntimes[0]];
        useRuntimeStore.getState().handleRuntimeExpired(mockRuntimes[0].uid);

      expect(mockElectronAPI.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Runtime Expired',
        })
      );
    });
  });

  describe('storage persistence', () => {
    it('should save runtimes to storage', async () => {
      const store = useRuntimeStore.getState();

      await store.createRuntimeForNotebook('notebook-1', '/path');

      const stored = sessionStorage.getItem('datalayer-runtimes');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed[0]).toMatchObject({
        notebookId: 'notebook-1',
        notebookPath: '/path',
      });
    });

    it('should load runtimes from storage', () => {
      const runtimeData = [
        {
          notebookId: 'notebook-1',
          notebookPath: '/path',
          runtime: mockRuntimes[0],
        },
      ];

      sessionStorage.setItem('datalayer-runtimes', JSON.stringify(runtimeData));

      const store = useRuntimeStore.getState();

        useRuntimeStore.getState().loadRuntimesFromStorage();

      expect(useRuntimeStore.getState().notebookRuntimes.has('notebook-1')).toBe(true);
    });
  });

  describe('multiple notebook support', () => {
    it('should allow opening multiple notebooks', () => {
      const store = useRuntimeStore.getState();

      const { allowed } = useRuntimeStore.getState().canOpenNotebook('notebook-1');
      expect(allowed).toBe(true);
    });

    it('should manage multiple runtimes simultaneously', async () => {
      const store = useRuntimeStore.getState();

      mockDatalayerAPI.createRuntime
        .mockResolvedValueOnce({
          success: true,
          data: { runtime: mockRuntimes[0] },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { runtime: mockRuntimes[1] },
        });

      await store.createRuntimeForNotebook('notebook-1');
        await store.createRuntimeForNotebook('notebook-2');

      expect(useRuntimeStore.getState().notebookRuntimes.size).toBe(2);
    });
  });
});
