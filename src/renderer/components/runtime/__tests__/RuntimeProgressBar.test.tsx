/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for RuntimeProgressBar component.
 * Tests basic rendering and runtime details fetching.
 *
 * @module RuntimeProgressBar.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { RuntimeProgressBar } from '../RuntimeProgressBar';

describe('RuntimeProgressBar', () => {
  let mockGetRuntime: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetRuntime = vi.fn();
    (window as unknown as Record<string, unknown>).datalayerClient = {
      getRuntime: mockGetRuntime,
    };
  });

  describe('rendering', () => {
    it('should render nothing when no runtime is provided', () => {
      const { container } = render(<RuntimeProgressBar />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('runtime details fetching', () => {
    it('should fetch runtime details on mount', async () => {
      const now = Date.now();
      mockGetRuntime.mockResolvedValue({
        startedAt: new Date(now - 1000).toISOString(),
        expiredAt: new Date(now + 59000).toISOString(),
      });

      render(<RuntimeProgressBar runtimePodName="runtime-test" />);

      await waitFor(
        () => {
          expect(mockGetRuntime).toHaveBeenCalledWith('runtime-test');
          expect(mockGetRuntime).toHaveBeenCalledTimes(1);
        },
        { timeout: 100 }
      );
    });

    it('should handle API errors gracefully', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetRuntime.mockRejectedValue(new Error('API Error'));

      const { container } = render(
        <RuntimeProgressBar runtimePodName="runtime-error" />
      );

      await waitFor(() => {
        expect(mockGetRuntime).toHaveBeenCalled();
      });

      // Should still render but with no percentage
      expect(container.firstChild).toBeInTheDocument();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should refetch when runtimePodName changes', async () => {
      const now = Date.now();
      mockGetRuntime.mockResolvedValue({
        startedAt: new Date(now - 1000).toISOString(),
        expiredAt: new Date(now + 59000).toISOString(),
      });

      const { rerender } = render(
        <RuntimeProgressBar runtimePodName="runtime-1" />
      );

      await waitFor(() => {
        expect(mockGetRuntime).toHaveBeenCalledWith('runtime-1');
      });

      rerender(<RuntimeProgressBar runtimePodName="runtime-2" />);

      await waitFor(() => {
        expect(mockGetRuntime).toHaveBeenCalledWith('runtime-2');
        expect(mockGetRuntime).toHaveBeenCalledTimes(2);
      });
    });

    it('should clear runtime details when runtimePodName becomes undefined', async () => {
      const now = Date.now();
      mockGetRuntime.mockResolvedValue({
        startedAt: new Date(now - 1000).toISOString(),
        expiredAt: new Date(now + 59000).toISOString(),
      });

      const { rerender, container } = render(
        <RuntimeProgressBar runtimePodName="runtime-1" />
      );

      await waitFor(() => {
        expect(mockGetRuntime).toHaveBeenCalled();
      });

      rerender(<RuntimeProgressBar />);

      // Should render nothing
      expect(container.firstChild).toBeNull();
    });
  });
});
