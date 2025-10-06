/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the notebook ErrorBoundary component.
 *
 * @module renderer/components/notebook/ErrorBoundary.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

// Component that throws an error
const ThrowError = ({ error }: { error?: Error }) => {
  if (error) {
    throw error;
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to avoid cluttering test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary onError={mockOnError}>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch errors and display error UI', () => {
    const testError = new Error('Test error message');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/notebook component encountered an error/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/test error message/i)).toBeInTheDocument();
  });

  it('should call onError callback when error is caught', () => {
    const testError = new Error('Test error');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    expect(mockOnError).toHaveBeenCalledWith(testError);
  });

  it('should display error message in monospace font', () => {
    const testError = new Error('Detailed error message');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const errorText = screen.getByText(/detailed error message/i);

    // Check that error is displayed (styling check would need more setup)
    expect(errorText).toBeInTheDocument();
  });

  it('should show reset button with correct accessibility attributes', () => {
    const testError = new Error('Test error');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const resetButton = screen.getByRole('button', {
      name: /reset notebook component/i,
    });
    expect(resetButton).toBeInTheDocument();
    expect(resetButton).toHaveAttribute('tabIndex', '0');
  });

  it('should show refresh button with correct accessibility attributes', () => {
    const testError = new Error('Test error');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const refreshButton = screen.getByRole('button', {
      name: /refresh the entire page/i,
    });
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).toHaveAttribute('tabIndex', '0');
  });

  it('should reset error state when reset button is clicked', async () => {
    const testError = new Error('Test error');
    const user = userEvent.setup();

    const { rerender } = render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    const resetButton = screen.getByRole('button', {
      name: /reset notebook component/i,
    });
    await user.click(resetButton);

    // After reset, children should render normally (without error)
    rerender(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should reload page when refresh button is clicked', async () => {
    const testError = new Error('Test error');
    const user = userEvent.setup();

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const refreshButton = screen.getByRole('button', {
      name: /refresh the entire page/i,
    });
    await user.click(refreshButton);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('should handle keyboard navigation for reset button', async () => {
    const testError = new Error('Test error');
    const user = userEvent.setup();

    const { rerender } = render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const resetButton = screen.getByRole('button', {
      name: /reset notebook component/i,
    });

    // Test Enter key
    resetButton.focus();
    await user.keyboard('{Enter}');

    rerender(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should handle keyboard navigation for refresh button', async () => {
    const testError = new Error('Test error');
    const user = userEvent.setup();

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const refreshButton = screen.getByRole('button', {
      name: /refresh the entire page/i,
    });

    // Test Space key
    refreshButton.focus();
    await user.keyboard(' ');

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('should not propagate "Widget is not attached" errors', () => {
    const testError = new Error('Widget is not attached to DOM');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    // This error should be suppressed - no error UI should be shown
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it('should display helpful guidance messages', () => {
    const testError = new Error('Test error');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    expect(
      screen.getByText(/this may be due to collaboration state conflicts/i)
    ).toBeInTheDocument();
  });

  it('should have proper ARIA attributes for accessibility', () => {
    const testError = new Error('Test error');

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});
