/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * The menu (DESKTOP DK-04): the template built from one pure function,
 * asserted entry by entry with the `when` of each — signed out: no
 * session on Datalayer and no sign-out; no local runtime: no stop; no
 * session in front: no export and no Open in the Studio; the developer
 * tools only when allowed; macOS and the others — and the wiring: an
 * entry's action sent to the renderer as `menu-action`.
 */

import { describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  send: vi.fn(),
  setApplicationMenu: vi.fn(),
  built: [] as unknown[],
  openExternal: vi.fn(),
  runtimeRunning: false,
  runtimeListeners: [] as Array<() => void>,
}));

vi.mock('electron', () => ({
  app: { getName: () => 'Datalayer Desktop', quit: vi.fn() },
  Menu: {
    buildFromTemplate: vi.fn((template: unknown[]) => {
      electron.built = template;
      return { template };
    }),
    setApplicationMenu: electron.setApplicationMenu,
  },
  shell: { openExternal: electron.openExternal },
}));
vi.mock('../environment', () => ({ shouldEnableDevTools: () => true }));
vi.mock('../../dialogs/about/about-dialog', () => ({
  createAboutDialog: vi.fn(),
}));
vi.mock('../../services/local-runtime', () => ({
  anyLocalRuntime: () => electron.runtimeRunning,
  localRuntimes: {
    onChange: (listener: () => void) => {
      electron.runtimeListeners.push(listener);
      return () => undefined;
    },
  },
}));
vi.mock('../window-manager', () => ({
  getMainWindow: () => ({
    isDestroyed: () => false,
    webContents: { send: electron.send },
  }),
}));

import {
  HELP_URLS,
  actionsOf,
  createMenu,
  menuTemplate,
  refreshMenu,
  type MenuEntry,
  type MenuState,
} from '../menu-manager';

const base: MenuState = {
  platform: 'linux',
  appName: 'Datalayer Desktop',
  signedIn: false,
  localRuntimeRunning: false,
  sessionInFront: false,
  devTools: false,
};

const labels = (entries: MenuEntry[]): string[] =>
  entries.map(e => ('type' in e ? '—' : e.label));
const menu = (template: MenuEntry[], label: string): MenuEntry[] => {
  const found = template.find(e => !('type' in e) && e.label === label);
  return found && !('type' in found) ? found.submenu || [] : [];
};

describe('menuTemplate', () => {
  it('signed out, no runtime, nothing in front: the folder, the import, the views, the help', () => {
    const template = menuTemplate(base);
    expect(labels(template)).toEqual([
      'File',
      'Edit',
      'Sessions',
      'View',
      'Help',
    ]);
    expect(labels(menu(template, 'File'))).toEqual([
      'Work in a folder…',
      'Import a session…',
      '—',
      'Quit',
    ]);
    expect(labels(menu(template, 'Sessions'))).toEqual(['Resume last']);
    expect(labels(menu(template, 'View'))).toEqual([
      'Sessions',
      'Studio',
      'Spaces',
      'Agents',
      'Environments',
      '—',
      'Reload',
      'Force Reload',
      '—',
      'Actual Size',
      'Zoom In',
      'Zoom Out',
      '—',
      'Toggle Fullscreen',
    ]);
    expect(labels(menu(template, 'Help'))).toEqual([
      'Datalayer docs',
      'Report a problem',
      'GitHub',
      '—',
      'About Datalayer Desktop',
    ]);
    expect(actionsOf(template)).toEqual([
      'work-in-folder',
      'import-session',
      'resume-last-session',
      'show-sessions',
      'show-studio',
      'show-spaces',
      'show-runtimes',
      'show-environments',
    ]);
  });

  it('signed in: a session on Datalayer and sign out; a runtime running: its stop; a session in front: export and Open in the Studio', () => {
    const template = menuTemplate({
      ...base,
      signedIn: true,
      localRuntimeRunning: true,
      sessionInFront: true,
    });
    expect(labels(menu(template, 'File'))).toEqual([
      'Work in a folder…',
      'New session on Datalayer…',
      'Import a session…',
      '—',
      'Stop the local runtime',
      '—',
      'Sign out',
      'Quit',
    ]);
    expect(labels(menu(template, 'Sessions'))).toEqual([
      'Resume last',
      'Export…',
      'Open in the Studio',
    ]);
    expect(actionsOf(template)).toContain('new-datalayer-session');
    expect(actionsOf(template)).toContain('stop-local-runtime');
    expect(actionsOf(template)).toContain('sign-out');
  });

  it('a session in front while signed out: export, but no Studio for it', () => {
    const template = menuTemplate({ ...base, sessionInFront: true });
    expect(labels(menu(template, 'Sessions'))).toEqual([
      'Resume last',
      'Export…',
    ]);
  });

  it('the developer tools only when allowed', () => {
    expect(
      labels(menu(menuTemplate({ ...base, devTools: true }), 'View'))
    ).toContain('Toggle Developer Tools');
    expect(labels(menu(menuTemplate(base), 'View'))).not.toContain(
      'Toggle Developer Tools'
    );
  });

  it('on macOS the app menu carries About, Sign out and Quit, and File carries no Quit', () => {
    const template = menuTemplate({
      ...base,
      platform: 'darwin',
      signedIn: true,
    });
    expect(labels(template)).toEqual([
      'Datalayer Desktop',
      'File',
      'Edit',
      'Sessions',
      'View',
      'Window',
      'Help',
    ]);
    expect(labels(menu(template, 'Datalayer Desktop'))).toEqual([
      'About Datalayer Desktop',
      '—',
      'Sign out',
      '—',
      'Services',
      '—',
      'Hide Datalayer Desktop',
      'Hide Others',
      'Show All',
      '—',
      'Quit',
    ]);
    expect(labels(menu(template, 'File'))).toEqual([
      'Work in a folder…',
      'New session on Datalayer…',
      'Import a session…',
    ]);
    expect(labels(menu(template, 'Help'))).toEqual([
      'Datalayer docs',
      'Report a problem',
      'GitHub',
    ]);
    const signedOut = menuTemplate({ ...base, platform: 'darwin' });
    expect(labels(menu(signedOut, 'Datalayer Desktop'))).not.toContain(
      'Sign out'
    );
  });

  it('the shortcuts are in the menu', () => {
    const file = menu(
      menuTemplate({ ...base, signedIn: true }),
      'File'
    ) as Array<{ label?: string; accelerator?: string }>;
    expect(file.find(e => e.label === 'Work in a folder…')?.accelerator).toBe(
      'CmdOrCtrl+O'
    );
    expect(
      file.find(e => e.label === 'New session on Datalayer…')?.accelerator
    ).toBe('CmdOrCtrl+N');
    const view = menu(menuTemplate(base), 'View') as Array<{
      label?: string;
      accelerator?: string;
    }>;
    expect(view.find(e => e.label === 'Sessions')?.accelerator).toBe(
      'CmdOrCtrl+1'
    );
    expect(view.find(e => e.label === 'Studio')?.accelerator).toBe(
      'CmdOrCtrl+2'
    );
  });
});

describe('the wiring', () => {
  it('builds the menu, sends an entry’s action to the renderer, and rebuilds on a change', () => {
    createMenu();
    expect(electron.setApplicationMenu).toHaveBeenCalledTimes(1);
    type Built = { label?: string; submenu?: Built[]; click?: () => void };
    const file = (electron.built as Built[]).find(m => m.label === 'File')!;
    file.submenu!.find(e => e.label === 'Work in a folder…')!.click!();
    expect(electron.send).toHaveBeenCalledWith('menu-action', 'work-in-folder');
    expect(file.submenu!.map(e => e.label)).not.toContain(
      'Stop the local runtime'
    );
    refreshMenu({ signedIn: true });
    expect(electron.setApplicationMenu).toHaveBeenCalledTimes(2);
    const again = (electron.built as Built[]).find(m => m.label === 'File')!;
    expect(again.submenu!.map(e => e.label)).toContain('Sign out');
    expect(again.submenu!.map(e => e.label)).not.toContain(
      'Stop the local runtime'
    );
    // A local runtime started (DK-05): the runtimes say so, the menu follows.
    electron.runtimeRunning = true;
    expect(electron.runtimeListeners).toHaveLength(1);
    electron.runtimeListeners[0]();
    expect(electron.setApplicationMenu).toHaveBeenCalledTimes(3);
    const running = (electron.built as Built[]).find(m => m.label === 'File')!;
    expect(running.submenu!.map(e => e.label)).toContain(
      'Stop the local runtime'
    );
    const help = (electron.built as Built[]).find(m => m.label === 'Help')!;
    help.submenu!.find(e => e.label === 'Report a problem')!.click!();
    expect(electron.openExternal).toHaveBeenCalledWith(HELP_URLS.report);
  });
});
