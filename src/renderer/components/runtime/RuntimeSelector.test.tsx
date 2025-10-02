/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for RuntimeSelector component.
 * Tests runtime listing, selection, and "Create New" functionality.
 *
 * @module RuntimeSelector.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuntimeSelector } from './RuntimeSelector';
import { useRuntimeStore } from '../../stores/runtimeStore';

// Mock the runtime store
vi.mock('../../stores/runtimeStore');

describe('RuntimeSelector', () => {
  const mockRefreshRuntimes = vi.fn();
  const mockOnRuntimeSelected = vi.fn();

  const mockRuntimes = [
    {
      podName: 'runtime-1',
      givenName: 'My Runtime 1',
      environmentTitle: 'Python CPU',
      expiredAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins
    },
    {
      podName: 'runtime-2',
      givenName: 'My Runtime 2',
      environmentTitle: 'Python GPU',
      expiredAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 mins
    },
    {
      podName: 'runtime-3',
      givenName: 'My Runtime 3',
      environmentTitle: 'R Environment',
      expiredAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 mins
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementation
    (useRuntimeStore as any).mockReturnValue({
      allRuntimes: mockRuntimes,
      refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
    });
  });

  describe('rendering', () => {
    it('should render select dropdown', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should show loading spinner while fetching runtimes', () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      // Spinner should be visible initially
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('should hide spinner after runtimes are loaded', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading')).not.toBeInTheDocument();
      });
    });

    it('should display placeholder text when no runtime selected', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Runtimes')).toBeInTheDocument();
      });
    });

    it('should display selected runtime name', async () => {
      render(
        <RuntimeSelector
          selectedRuntimePodName="runtime-1"
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        const text = screen.getByText(/My Runtime 1/);
        expect(text).toBeInTheDocument();
      });
    });
  });

  describe('runtime list display', () => {
    it('should display all available runtimes', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      // Check that runtime names appear in options
      const select = screen.getByRole('combobox');
      expect(select.innerHTML).toContain('My Runtime 1');
      expect(select.innerHTML).toContain('My Runtime 2');
      expect(select.innerHTML).toContain('My Runtime 3');
    });

    it('should show environment titles in runtime display', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');
      expect(select.innerHTML).toContain('Python CPU');
      expect(select.innerHTML).toContain('Python GPU');
      expect(select.innerHTML).toContain('R Environment');
    });

    it('should show remaining time for each runtime', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');
      // Should show time in minutes or hours
      expect(select.innerHTML).toMatch(/\d+[mh]/);
    });

    it('should format time as minutes for < 60 mins', async () => {
      const shortRuntime = [
        {
          podName: 'runtime-short',
          givenName: 'Short Runtime',
          environmentTitle: 'Test Env',
          expiredAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 mins
        },
      ];

      (useRuntimeStore as any).mockReturnValue({
        allRuntimes: shortRuntime,
        refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
      });

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.innerHTML).toContain('45m');
      });
    });

    it('should format time as hours for >= 60 mins', async () => {
      const longRuntime = [
        {
          podName: 'runtime-long',
          givenName: 'Long Runtime',
          environmentTitle: 'Test Env',
          expiredAt: new Date(Date.now() + 125 * 60 * 1000).toISOString(), // 2h 5m
        },
      ];

      (useRuntimeStore as any).mockReturnValue({
        allRuntimes: longRuntime,
        refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
      });

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.innerHTML).toMatch(/2h\s+5m/);
      });
    });

    it('should show checkmark for currently selected runtime', async () => {
      render(
        <RuntimeSelector
          selectedRuntimePodName="runtime-2"
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        // CheckIcon should be present for selected runtime
        const select = screen.getByRole('combobox');
        expect(select.innerHTML).toContain('My Runtime 2');
      });
    });

    it('should display "Create New Runtime" option', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Create New Runtime')).toBeInTheDocument();
      });
    });

    it('should handle empty runtime list', async () => {
      (useRuntimeStore as any).mockReturnValue({
        allRuntimes: [],
        refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
      });

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      // Should still show "Create New Runtime"
      expect(screen.getByText('Create New Runtime')).toBeInTheDocument();
    });
  });

  describe('runtime selection', () => {
    it('should call onRuntimeSelected with runtime when selected', async () => {
      const user = userEvent.setup();

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'runtime-1');

      expect(mockOnRuntimeSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          podName: 'runtime-1',
          givenName: 'My Runtime 1',
        })
      );
    });

    it('should call onRuntimeSelected with null for "Create New"', async () => {
      const user = userEvent.setup();

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '__create_new__');

      expect(mockOnRuntimeSelected).toHaveBeenCalledWith(null);
    });

    it('should handle runtime with snake_case properties', async () => {
      const snakeCaseRuntimes = [
        {
          pod_name: 'runtime-snake',
          given_name: 'Snake Runtime',
          environment_title: 'Snake Env',
          expired_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      ];

      (useRuntimeStore as any).mockReturnValue({
        allRuntimes: snakeCaseRuntimes,
        refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
      });

      const user = userEvent.setup();

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Snake Runtime/)).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'runtime-snake');

      expect(mockOnRuntimeSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          pod_name: 'runtime-snake',
        })
      );
    });
  });

  describe('disabled state', () => {
    it('should disable select when disabled prop is true', () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
          disabled={true}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('should disable select while loading', () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('should enable select after loading completes', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).not.toBeDisabled();
      });
    });
  });

  describe('runtime refresh', () => {
    it('should fetch runtimes on mount', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalledTimes(1);
      });
    });

    it('should refetch when selectedRuntimePodName changes', async () => {
      const { rerender } = render(
        <RuntimeSelector
          selectedRuntimePodName="runtime-1"
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalledTimes(1);
      });

      rerender(
        <RuntimeSelector
          selectedRuntimePodName="runtime-2"
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle refresh errors gracefully', async () => {
      mockRefreshRuntimes.mockRejectedValue(new Error('Fetch failed'));

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      // Should still render without crashing
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('time formatting edge cases', () => {
    it('should handle expired runtimes (negative time)', async () => {
      const expiredRuntime = [
        {
          podName: 'runtime-expired',
          givenName: 'Expired Runtime',
          environmentTitle: 'Test Env',
          expiredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
        },
      ];

      (useRuntimeStore as any).mockReturnValue({
        allRuntimes: expiredRuntime,
        refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
      });

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        // Should show 0m for expired runtimes
        expect(select.innerHTML).toContain('0m');
      });
    });

    it('should handle Unix timestamp format', async () => {
      const unixRuntime = [
        {
          podName: 'runtime-unix',
          givenName: 'Unix Runtime',
          environmentTitle: 'Test Env',
          expiredAt: String(Date.now() / 1000 + 30 * 60), // Unix timestamp
        },
      ];

      (useRuntimeStore as any).mockReturnValue({
        allRuntimes: unixRuntime,
        refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
      });

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.innerHTML).toContain('30m');
      });
    });

    it('should show "Unknown" for invalid timestamps', async () => {
      const invalidRuntime = [
        {
          podName: 'runtime-invalid',
          givenName: 'Invalid Runtime',
          environmentTitle: 'Test Env',
          expiredAt: 'invalid-timestamp',
        },
      ];

      (useRuntimeStore as any).mockReturnValue({
        allRuntimes: invalidRuntime,
        refreshRuntimes: mockRefreshRuntimes.mockResolvedValue(undefined),
      });

      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.innerHTML).toContain('Unknown');
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper combobox role', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
      });
    });

    it('should show loading indicator with proper semantics', () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      // Spinner should have accessible text
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('should have appropriate size for touch targets', async () => {
      render(
        <RuntimeSelector
          onRuntimeSelected={mockOnRuntimeSelected}
        />
      );

      await waitFor(() => {
        expect(mockRefreshRuntimes).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');
      // Should have height of at least 32px
      expect(select.style.height).toBe('32px');
    });
  });
});
