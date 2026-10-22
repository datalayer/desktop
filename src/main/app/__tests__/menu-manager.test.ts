/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * The menu (DESKTOP DK-04): the template built from one pure function,
 * asserted entry by entry with the `when` of each — signed out: no
 * session on Datalayer and no sign-out; no local runtime: no stop; no
 * session in front: no export and no Open in Apps; the developer
 * tools only when allowed; macOS and the others; Sessions first, then
 * Edit; signed out, every menu but Help disabled — and the wiring: an
 * entry's action sent to the renderer as `menu-action`, the menu rebuilt
 * on sign-in.
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
/** The wiring builds for the host's OS. */
const onMac = process.platform === 'darwin';

/** The labels of the top-level menus Electron would show enabled. */
const enabledLabels = (
  built: Array<{ label?: string; enabled?: boolean }>
): Array<string | undefined> =>
  built.filter(m => m.enabled !== false).map(m => m.label);

/** Each top-level menu's label and whether it is enabled. */
const enabledOf = (template: MenuEntry[]): Record<string, boolean> =>
  Object.fromEntries(
    template.flatMap(e =>
      'type' in e ? [] : [[e.label, e.enabled !== false] as const]
    )
  );
const menu = (template: MenuEntry[], label: string): MenuEntry[] => {
  const found = template.find(e => !('type' in e) && e.label === label);
  return found && !('type' in found) ? found.submenu || [] : [];
};

describe('menuTemplate', () => {
  it('signed out, no runtime, nothing in front: the folder, the import, the views, the help', () => {
    const template = menuTemplate(base);
    expect(labels(template)).toEqual([
      'Sessions',
      'Edit',
      'File',
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
      'Apps',
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
      'resume-last-session',
      'work-in-folder',
      'import-session',
      'show-sessions',
      'show-apps',
      'show-spaces',
      'show-runtimes',
      'show-environments',
    ]);
  });

  it('signed in: a session on Datalayer and sign out; a runtime running: its stop; a session in front: export and Open in Apps', () => {
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
      'Open in Apps',
    ]);
    expect(actionsOf(template)).toContain('new-datalayer-session');
    expect(actionsOf(template)).toContain('stop-local-runtime');
    expect(actionsOf(template)).toContain('sign-out');
  });

  it('a session in front while signed out: export, but no Apps for it', () => {
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
      'Sessions',
      'Edit',
      'File',
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

  it('signed out, every menu but Help is disabled', () => {
    const template = menuTemplate(base);
    expect(enabledOf(template)).toEqual({
      Sessions: false,
      Edit: false,
      File: false,
      View: false,
      Help: true,
    });
    // Help's entries are all usable.
    expect(
      menu(template, 'Help').every(e => 'type' in e || e.enabled !== false)
    ).toBe(true);
  });

  it('signed in, every menu is enabled', () => {
    const template = menuTemplate({ ...base, signedIn: true });
    expect(enabledOf(template)).toEqual({
      Sessions: true,
      Edit: true,
      File: true,
      View: true,
      Help: true,
    });
    const mac = menuTemplate({ ...base, platform: 'darwin', signedIn: true });
    expect(Object.values(enabledOf(mac)).every(Boolean)).toBe(true);
    expect(
      menu(mac, 'Datalayer Desktop').every(
        e => 'type' in e || e.enabled !== false
      )
    ).toBe(true);
  });

  it('signed out on macOS, the app menu keeps About and Quit, Edit keeps paste, the rest but Help is disabled', () => {
    const template = menuTemplate({ ...base, platform: 'darwin' });
    expect(enabledOf(template)).toEqual({
      'Datalayer Desktop': true,
      Sessions: false,
      Edit: true,
      File: false,
      View: false,
      Window: false,
      Help: true,
    });
    const usable = menu(template, 'Datalayer Desktop')
      .filter(e => !('type' in e) && e.enabled !== false)
      .map(e => ('type' in e ? '—' : e.label));
    expect(usable).toEqual(['About Datalayer Desktop', 'Quit']);
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
    expect(view.find(e => e.label === 'Apps')?.accelerator).toBe('CmdOrCtrl+2');
  });
});

describe('the wiring', () => {
  it('builds the menu, sends an entry’s action to the renderer, and rebuilds on a change', () => {
    createMenu();
    expect(electron.setApplicationMenu).toHaveBeenCalledTimes(1);
    type Built = {
      label?: string;
      enabled?: boolean;
      submenu?: Built[];
      click?: () => void;
    };
    const file = (electron.built as Built[]).find(m => m.label === 'File')!;
    // Signed out: Sessions first (after the app menu on macOS), then Edit;
    // the disabled menus are the ones the template says (the host's OS).
    const builtLabels = (electron.built as Built[]).map(m => m.label);
    expect(builtLabels.slice(onMac ? 1 : 0, onMac ? 3 : 2)).toEqual([
      'Sessions',
      'Edit',
    ]);
    expect(enabledLabels(electron.built as Built[])).toEqual(
      onMac ? ['Datalayer Desktop', 'Edit', 'Help'] : ['Help']
    );
    file.submenu!.find(e => e.label === 'Work in a folder…')!.click!();
    expect(electron.send).toHaveBeenCalledWith('menu-action', 'work-in-folder');
    expect(file.submenu!.map(e => e.label)).not.toContain(
      'Stop the local runtime'
    );
    refreshMenu({ signedIn: true });
    expect(electron.setApplicationMenu).toHaveBeenCalledTimes(2);
    const again = (electron.built as Built[]).find(m => m.label === 'File')!;
    // Signed in: the menu is rebuilt, everything enabled.
    expect((electron.built as Built[]).every(m => m.enabled !== false)).toBe(
      true
    );
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

describe('signing out rebuilds the menu disabled', () => {
  it('refreshMenu with signedIn false greys all but Help again', () => {
    refreshMenu({ signedIn: true });
    refreshMenu({ signedIn: false });
    type Built = { label?: string; enabled?: boolean };
    expect(enabledLabels(electron.built as Built[])).toEqual(
      onMac ? ['Datalayer Desktop', 'Edit', 'Help'] : ['Help']
    );
  });
});
