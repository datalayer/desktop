/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppHeader from '../Header';
import { useThemeStore } from '../../../theme/themeStore';

const props = {
  activeTabId: 'home',
  openNotebooks: [],
  openDocuments: [],
  isAuthenticated: false,
  user: null,
  onTabChange: vi.fn(),
  onNotebookClose: vi.fn(),
  onDocumentClose: vi.fn(),
  onLogout: vi.fn(),
};

describe('AppHeader appearance', () => {
  it('shows the appearance menu, its trigger naming the stored colour mode', () => {
    useThemeStore.setState({ colorMode: 'dark', theme: 'matrix' });
    render(<AppHeader {...props} />);

    expect(
      screen.getByRole('button', { name: /^Color mode: Dark\./ })
    ).toBeInTheDocument();
  });

  it("writes the menu's choice to the desktop's theme store", async () => {
    useThemeStore.setState({ colorMode: 'light', theme: 'matrix' });
    const user = userEvent.setup();
    render(<AppHeader {...props} />);

    await user.hover(
      screen.getByRole('button', { name: /^Color mode: Light\./ })
    );
    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(useThemeStore.getState().colorMode).toBe('dark');
    expect(useThemeStore.getState().theme).toBe('matrix');
  });
});
