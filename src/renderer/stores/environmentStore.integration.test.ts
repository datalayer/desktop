/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the environment store.
 *
 * @module renderer/stores/environmentStore.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEnvironmentStore } from './environmentStore';
import { mockEnvironments } from '../../../tests/fixtures';

// Mock the window.datalayerClient
const mockDatalayerClient = {
  listEnvironments: vi.fn(),
};

beforeEach(() => {
  // Setup window mock
  (global as any).window = {
    datalayerClient: mockDatalayerClient,
  };

  // Reset store state
  const { result } = renderHook(() => useEnvironmentStore());
  act(() => {
    result.current.setEnvironments([]);
    result.current.invalidateCache();
    result.current.setLoading(false);
    result.current.setError(null);
    result.current.setSelectedEnvironment(null);
  });

  // Clear mocks
  vi.clearAllMocks();

  // Default successful response
  mockDatalayerClient.listEnvironments.mockResolvedValue(mockEnvironments);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('environmentStore', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      expect(result.current.environments).toEqual([]);
      expect(result.current.lastFetchTime).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.selectedEnvironment).toBeNull();
      expect(result.current.cacheExpiryMs).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('setEnvironments', () => {
    it('should update environments and set lastFetchTime', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      act(() => {
        result.current.setEnvironments(mockEnvironments);
      });

      expect(result.current.environments).toEqual(mockEnvironments);
      expect(result.current.lastFetchTime).not.toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('setSelectedEnvironment', () => {
    it('should update selected environment', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      act(() => {
        result.current.setSelectedEnvironment('python-cpu-env');
      });

      expect(result.current.selectedEnvironment).toBe('python-cpu-env');
    });

    it('should allow clearing selected environment', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      act(() => {
        result.current.setSelectedEnvironment('python-cpu-env');
        result.current.setSelectedEnvironment(null);
      });

      expect(result.current.selectedEnvironment).toBeNull();
    });
  });

  describe('cache management', () => {
    it('should validate cache when fresh', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      act(() => {
        result.current.setEnvironments(mockEnvironments);
      });

      expect(result.current.isCacheValid()).toBe(true);
    });

    it('should invalidate cache when expired', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      act(() => {
        result.current.setEnvironments(mockEnvironments);
        result.current.setCacheExpiry(0); // Set to expire immediately
      });

      // Wait a moment
      setTimeout(() => {
        expect(result.current.isCacheValid()).toBe(false);
      }, 10);
    });

    it('should manually invalidate cache', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      act(() => {
        result.current.setEnvironments(mockEnvironments);
        result.current.invalidateCache();
      });

      expect(result.current.isCacheValid()).toBe(false);
      expect(result.current.lastFetchTime).toBeNull();
    });

    it('should allow updating cache expiry time', () => {
      const { result } = renderHook(() => useEnvironmentStore());

      act(() => {
        result.current.setCacheExpiry(10 * 60 * 1000); // 10 minutes
      });

      expect(result.current.cacheExpiryMs).toBe(10 * 60 * 1000);
    });
  });

  describe('fetchEnvironmentsIfNeeded', () => {
    it('should fetch environments when cache is invalid', async () => {
      const { result } = renderHook(() => useEnvironmentStore());

      await act(async () => {
        const environments = await result.current.fetchEnvironmentsIfNeeded();
        expect(environments).toEqual(mockEnvironments);
      });

      expect(mockDatalayerClient.listEnvironments).toHaveBeenCalledTimes(1);
      expect(result.current.environments).toEqual(mockEnvironments);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return cached data when cache is valid', async () => {
      const { result } = renderHook(() => useEnvironmentStore());

      // First fetch
      await act(async () => {
        await result.current.fetchEnvironmentsIfNeeded();
      });

      expect(mockDatalayerClient.listEnvironments).toHaveBeenCalledTimes(1);

      // Second fetch should use cache
      await act(async () => {
        await result.current.fetchEnvironmentsIfNeeded();
      });

      expect(mockDatalayerClient.listEnvironments).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should set loading state during fetch', async () => {
      const { result } = renderHook(() => useEnvironmentStore());

      let loadingDuringFetch = false;

      const fetchPromise = act(async () => {
        const promise = result.current.fetchEnvironmentsIfNeeded();
        loadingDuringFetch = result.current.isLoading;
        await promise;
      });

      await fetchPromise;

      expect(loadingDuringFetch).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle fetch errors gracefully', async () => {
      const { result } = renderHook(() => useEnvironmentStore());

      mockDatalayerClient.listEnvironments.mockRejectedValueOnce(
        new Error('Network error')
      );

      await act(async () => {
        try {
          await result.current.fetchEnvironmentsIfNeeded();
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should return existing data on fetch error', async () => {
      const { result } = renderHook(() => useEnvironmentStore());

      // Set some existing data
      act(() => {
        result.current.setEnvironments(mockEnvironments);
        result.current.invalidateCache(); // Force refetch
      });

      mockDatalayerClient.listEnvironments.mockRejectedValueOnce(
        new Error('Network error')
      );

      await act(async () => {
        const environments = await result.current.fetchEnvironmentsIfNeeded();
        expect(environments).toEqual(mockEnvironments);
      });
    });

    it('should not fetch concurrently', async () => {
      const { result } = renderHook(() => useEnvironmentStore());

      // Start two fetches simultaneously
      await act(async () => {
        const promise1 = result.current.fetchEnvironmentsIfNeeded();
        const promise2 = result.current.fetchEnvironmentsIfNeeded();

        await Promise.all([promise1, promise2]);
      });

      // Should only call API once
      expect(mockDatalayerClient.listEnvironments).toHaveBeenCalledTimes(1);
    });
  });

  describe('useEnvironments helper hook', () => {
    it('should provide simplified interface', () => {
      const { result } = renderHook(() => {
        // Re-import to get fresh hook
        const { useEnvironments } = require('./environmentStore');
        return useEnvironments();
      });

      expect(result.current).toHaveProperty('environments');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('selectedEnvironment');
      expect(result.current).toHaveProperty('selectEnvironment');
      expect(result.current).toHaveProperty('fetchIfNeeded');
      expect(result.current).toHaveProperty('refresh');
    });

    it('should invalidate cache and fetch on refresh', async () => {
      const { result } = renderHook(() => {
        const { useEnvironments } = require('./environmentStore');
        return useEnvironments();
      });

      // First load
      await act(async () => {
        await result.current.fetchIfNeeded();
      });

      expect(mockDatalayerClient.listEnvironments).toHaveBeenCalledTimes(1);

      // Refresh should force new fetch
      await act(async () => {
        await result.current.refresh();
      });

      expect(mockDatalayerClient.listEnvironments).toHaveBeenCalledTimes(2);
    });
  });
});
