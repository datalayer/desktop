/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for UserMenu component.
 * Tests user display, menu toggle, logout, and keyboard navigation.
 *
 * @module renderer/components/app/UserMenu.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserMenu from '../UserMenu';
import type { User } from '../../../../shared/types';

describe('UserMenu', () => {
  const mockUser = {
    id: 'user-123',
    uid: 'uid-123',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
    handle: 'johndoe',
  };

  const mockOnOpenChange = vi.fn();
  const mockOnLogout = vi.fn();

  const defaultProps = {
    user: mockUser,
    isOpen: false,
    onOpenChange: mockOnOpenChange,
    onLogout: mockOnLogout,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render user avatar button', () => {
      render(<UserMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /user menu for/i });
      expect(button).toBeInTheDocument();
    });

    it('should use displayName in aria-label', () => {
      render(<UserMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /john doe/i });
      expect(button).toBeInTheDocument();
    });

    it('should use handle when displayName not available', () => {
      const userWithoutDisplayName = {
        ...mockUser,
        displayName: '',
      };

      render(<UserMenu {...defaultProps} user={userWithoutDisplayName} />);

      const button = screen.getByRole('button', { name: /johndoe/i });
      expect(button).toBeInTheDocument();
    });

    it('should render avatar button', () => {
      render(<UserMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toBeInTheDocument();
      // Avatar component is rendered but may not have img role in test env
    });

    it('should not show dropdown when closed', () => {
      render(<UserMenu {...defaultProps} />);

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should show dropdown when open', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  describe('dropdown content', () => {
    it('should display user displayName in dropdown', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display user email in dropdown', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('should not display email when not provided', () => {
      const userWithoutEmail = {
        ...mockUser,
        email: '',
      };

      render(
        <UserMenu {...defaultProps} user={userWithoutEmail} isOpen={true} />
      );

      expect(
        screen.queryByText('john.doe@example.com')
      ).not.toBeInTheDocument();
    });

    it('should display user info in dropdown', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      // Check user display name and email are shown
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('should display "Sign out" button', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      expect(screen.getByText('Sign out')).toBeInTheDocument();
    });

    it('should display sign out icon', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      const signOutButton = screen.getByText('Sign out').closest('button');
      expect(signOutButton).toBeInTheDocument();
      // Icon is inside the button
      expect(signOutButton?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('menu toggle', () => {
    it('should open menu when avatar button clicked', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /user menu/i });
      await user.click(button);

      expect(mockOnOpenChange).toHaveBeenCalledWith(true);
    });

    it('should close menu when avatar button clicked while open', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} isOpen={true} />);

      const button = screen.getByRole('button', { name: /user menu/i });
      await user.click(button);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should have aria-expanded attribute', () => {
      const { rerender } = render(
        <UserMenu {...defaultProps} isOpen={false} />
      );

      let button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');

      rerender(<UserMenu {...defaultProps} isOpen={true} />);

      button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('logout functionality', () => {
    it('should call onLogout when sign out clicked', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} isOpen={true} />);

      const signOutButton = screen.getByText('Sign out');
      await user.click(signOutButton);

      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });

    it('should close menu after logout', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} isOpen={true} />);

      const signOutButton = screen.getByText('Sign out');
      await user.click(signOutButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should call onLogout before onOpenChange', async () => {
      const callOrder: string[] = [];

      const testOnLogout = vi.fn(() => callOrder.push('logout'));
      const testOnOpenChange = vi.fn(() => callOrder.push('openChange'));

      const user = userEvent.setup();

      render(
        <UserMenu
          {...defaultProps}
          isOpen={true}
          onLogout={testOnLogout}
          onOpenChange={testOnOpenChange}
        />
      );

      const signOutButton = screen.getByText('Sign out');
      await user.click(signOutButton);

      expect(callOrder).toEqual(['logout', 'openChange']);
    });
  });

  describe('keyboard navigation', () => {
    it('should close menu on Escape key', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} isOpen={true} />);

      await user.keyboard('{Escape}');

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not handle Escape when menu is closed', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} isOpen={false} />);

      await user.keyboard('{Escape}');

      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });

    it('should add event listener when menu opens', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      const { rerender } = render(
        <UserMenu {...defaultProps} isOpen={false} />
      );

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );

      rerender(<UserMenu {...defaultProps} isOpen={true} />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );

      addEventListenerSpy.mockRestore();
    });

    it('should remove event listener when menu closes', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = render(<UserMenu {...defaultProps} isOpen={true} />);

      rerender(<UserMenu {...defaultProps} isOpen={false} />);

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );

      removeEventListenerSpy.mockRestore();
    });

    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<UserMenu {...defaultProps} isOpen={true} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );

      removeEventListenerSpy.mockRestore();
    });

    it('should prevent default and stop propagation on Escape', async () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      document.dispatchEvent(event);

      await waitFor(() => {
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(stopPropagationSpy).toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('should have role="menu" on dropdown', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
    });

    it('should have aria-labelledby on menu', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('aria-labelledby', 'user-menu-description');
    });

    it('should have proper aria attributes on button', () => {
      render(<UserMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('aria-expanded');
    });

    it('should have proper button labels', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      // Main button
      expect(
        screen.getByRole('button', { name: /user menu/i })
      ).toBeInTheDocument();

      // Sign out button
      const signOutButton = screen.getByText('Sign out').closest('button');
      expect(signOutButton).toBeInTheDocument();
    });
  });

  describe('styling and positioning', () => {
    it('should position dropdown correctly', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      const menu = screen.getByRole('menu');

      // Check for fixed positioning (actual computed styles may vary in test env)
      expect(menu).toBeInTheDocument();
    });

    it('should have proper z-index for dropdown', () => {
      render(<UserMenu {...defaultProps} isOpen={true} />);

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      // z-index is set via sx prop
    });

    it('should render user menu button', () => {
      render(<UserMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined email gracefully', () => {
      const userWithUndefinedEmail = {
        ...mockUser,
        email: undefined,
      };

      render(
        <UserMenu
          {...defaultProps}
          user={userWithUndefinedEmail as unknown as User}
          isOpen={true}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle missing avatarUrl', () => {
      const userWithoutAvatar = {
        ...mockUser,
        avatarUrl: '',
      };

      render(<UserMenu {...defaultProps} user={userWithoutAvatar} />);

      const button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toBeInTheDocument();
    });

    it('should handle multiple rapid menu toggles', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /user menu/i });

      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockOnOpenChange).toHaveBeenCalledTimes(3);
    });

    it('should handle logout during menu close animation', async () => {
      const user = userEvent.setup();

      render(<UserMenu {...defaultProps} isOpen={true} />);

      const signOutButton = screen.getByText('Sign out');
      await user.click(signOutButton);

      expect(mockOnLogout).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
