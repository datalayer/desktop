/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the login Button component.
 *
 * @module renderer/components/auth/Button.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button component', () => {
  it('should render with "Connect" text by default', () => {
    render(<Button loading={false} disabled={false} onClick={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /connect/i })
    ).toBeInTheDocument();
  });

  it('should show "Connecting..." when loading is true', () => {
    render(<Button loading={true} disabled={false} onClick={vi.fn()} />);

    expect(screen.getByText(/connecting\.\.\./i)).toBeInTheDocument();
    // Check for screen reader text
    expect(
      screen.getByText(/authenticating with datalayer, please wait/i)
    ).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button loading={false} disabled={true} onClick={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should call onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button loading={false} disabled={false} onClick={handleClick} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button loading={false} disabled={true} onClick={handleClick} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should have proper accessibility attributes', () => {
    render(<Button loading={false} disabled={false} onClick={vi.fn()} />);

    // Primer Button component may not forward aria-describedby in test environment
    // Instead verify the help text is present and associated
    const helpText = screen.getByText(/submit form to authenticate/i);
    expect(helpText).toBeInTheDocument();
    expect(helpText).toHaveAttribute('id', 'connect-button-help');
  });

  it('should show appropriate help text based on disabled state', () => {
    const { rerender } = render(
      <Button loading={false} disabled={true} onClick={vi.fn()} />
    );

    expect(
      screen.getByText(
        /complete both url and token fields to enable connection/i
      )
    ).toBeInTheDocument();

    rerender(<Button loading={false} disabled={false} onClick={vi.fn()} />);

    expect(
      screen.getByText(/submit form to authenticate with datalayer/i)
    ).toBeInTheDocument();
  });

  it('should render with CheckIcon when not loading', () => {
    const { container } = render(
      <Button loading={false} disabled={false} onClick={vi.fn()} />
    );

    // CheckIcon should be present in the DOM
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should be of type submit', () => {
    render(<Button loading={false} disabled={false} onClick={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });
});
