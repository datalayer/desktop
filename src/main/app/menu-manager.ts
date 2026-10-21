/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The app menu (DESKTOP DK-04): it says what the app can do. *File → Work
 * in a folder…*, *New session on Datalayer…*, *Import a session…*, *Stop
 * the local runtime*; *Sessions → Resume last*, *Export…*, *Open in the
 * Apps*; *View → Sessions | Apps | Spaces | Agents | Environments*
 * and the developer tools; *Help → Datalayer docs*, *Report a problem*;
 * *Sign out*. The shortcuts are in the menu: the menu is the overlay.
 *
 * `menuTemplate` is pure: the entries from the state, each with its
 * `when` applied (signed out: no session on Datalayer and no sign-out; no
 * local runtime: no stop; no session in front: no export, no Apps for
 * it). Sessions comes first, then Edit, File, View (and Window on macOS),
 * Help; on macOS the app's own menu stays first, as the OS puts it. Signed
 * out, every menu but Help is disabled (see `signedOutTemplate`). `createMenu` and `refreshMenu` build Electron's menu from it; an
 * entry with an `action` sends it to the renderer as `menu-action`, which
 * already listens.
 *
 * @module main/app/menu-manager
 */

import { app, Menu, shell } from 'electron';
import { shouldEnableDevTools } from './environment';
import { createAboutDialog } from '../dialogs/about/about-dialog';
import { getMainWindow } from './window-manager';
import { EXTERNAL_URLS } from '../config/constants';
import { anyLocalRuntime, localRuntimes } from '../services/local-runtime';
import type { MenuActionId } from '../../shared/types/shell.types';

/** What the menu is built from. */
export interface MenuState {
  /** `process.platform`. */
  platform: NodeJS.Platform;
  /** The app's name, for the macOS app menu. */
  appName: string;
  /** The person is signed in to Datalayer. */
  signedIn: boolean;
  /** A local runtime (`loop serve`) of the app is running (DK-05). */
  localRuntimeRunning: boolean;
  /** A session is open in the chat (DK-07). */
  sessionInFront: boolean;
  /** The developer tools are allowed. */
  devTools: boolean;
}

/** What the menu does when an entry is clicked, beside an `action` or a `role`. */
export type MenuClick =
  'about' | 'quit' | 'docs' | 'report' | 'github' | 'learn-more';

/** One entry of the template: pure, with no Electron in it. */
export type MenuEntry =
  | { type: 'separator' }
  | {
      label: string;
      /** Sent to the renderer as `menu-action`. */
      action?: MenuActionId;
      /** Electron's own behaviour. */
      role?: string;
      /** What the main process does itself. */
      click?: MenuClick;
      accelerator?: string;
      /** False greys the entry out (and, on a top-level menu, all of it). */
      enabled?: boolean;
      submenu?: MenuEntry[];
    };

/** Where the Help entries go. */
export const HELP_URLS = {
  docs: 'https://datalayer.ai/docs',
  report: 'https://github.com/datalayer/desktop/issues/new',
} as const;

function fileMenu(state: MenuState): MenuEntry {
  const entries: MenuEntry[] = [
    {
      label: 'Work in a folder…',
      action: 'work-in-folder',
      accelerator: 'CmdOrCtrl+O',
    },
  ];
  if (state.signedIn) {
    entries.push({
      label: 'New session on Datalayer…',
      action: 'new-datalayer-session',
      accelerator: 'CmdOrCtrl+N',
    });
  }
  entries.push({ label: 'Import a session…', action: 'import-session' });
  if (state.localRuntimeRunning) {
    entries.push(
      { type: 'separator' },
      { label: 'Stop the local runtime', action: 'stop-local-runtime' }
    );
  }
  if (state.platform !== 'darwin') {
    entries.push({ type: 'separator' });
    if (state.signedIn) {
      entries.push({ label: 'Sign out', action: 'sign-out' });
    }
    entries.push({ label: 'Quit', click: 'quit', accelerator: 'Ctrl+Q' });
  }
  return { label: 'File', submenu: entries };
}

function editMenu(state: MenuState): MenuEntry {
  const entries: MenuEntry[] = [
    { label: 'Undo', role: 'undo' },
    { label: 'Redo', role: 'redo' },
    { type: 'separator' },
    { label: 'Cut', role: 'cut' },
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
  ];
  if (state.platform === 'darwin') {
    entries.push(
      { label: 'Paste and Match Style', role: 'pasteAndMatchStyle' },
      { label: 'Delete', role: 'delete' },
      { label: 'Select All', role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [
          { label: 'Start Speaking', role: 'startSpeaking' },
          { label: 'Stop Speaking', role: 'stopSpeaking' },
        ],
      }
    );
  } else {
    entries.push(
      { label: 'Delete', role: 'delete' },
      { label: 'Select All', role: 'selectAll' }
    );
  }
  return { label: 'Edit', submenu: entries };
}

function sessionsMenu(state: MenuState): MenuEntry {
  const entries: MenuEntry[] = [
    {
      label: 'Resume last',
      action: 'resume-last-session',
      accelerator: 'CmdOrCtrl+Shift+L',
    },
  ];
  if (state.sessionInFront) {
    entries.push({
      label: 'Export…',
      action: 'export-session',
      accelerator: 'CmdOrCtrl+Shift+E',
    });
    if (state.signedIn) {
      entries.push({ label: 'Open in Apps', action: 'open-in-apps' });
    }
  }
  return { label: 'Sessions', submenu: entries };
}

function viewMenu(state: MenuState): MenuEntry {
  const entries: MenuEntry[] = [
    { label: 'Sessions', action: 'show-sessions', accelerator: 'CmdOrCtrl+1' },
    { label: 'Apps', action: 'show-apps', accelerator: 'CmdOrCtrl+2' },
    { label: 'Spaces', action: 'show-spaces', accelerator: 'CmdOrCtrl+3' },
    { label: 'Agents', action: 'show-runtimes', accelerator: 'CmdOrCtrl+4' },
    {
      label: 'Environments',
      action: 'show-environments',
      accelerator: 'CmdOrCtrl+5',
    },
    { type: 'separator' },
    { label: 'Reload', role: 'reload' },
    { label: 'Force Reload', role: 'forceReload' },
  ];
  if (state.devTools) {
    entries.push({ label: 'Toggle Developer Tools', role: 'toggleDevTools' });
  }
  entries.push(
    { type: 'separator' },
    { label: 'Actual Size', role: 'resetZoom' },
    { label: 'Zoom In', role: 'zoomIn' },
    { label: 'Zoom Out', role: 'zoomOut' },
    { type: 'separator' },
    { label: 'Toggle Fullscreen', role: 'togglefullscreen' }
  );
  return { label: 'View', submenu: entries };
}

function windowMenu(): MenuEntry {
  return {
    label: 'Window',
    submenu: [
      { label: 'Minimize', role: 'minimize' },
      { label: 'Close', role: 'close' },
      { type: 'separator' },
      { label: 'Bring All to Front', role: 'front' },
    ],
  };
}

function helpMenu(state: MenuState): MenuEntry {
  const entries: MenuEntry[] = [
    { label: 'Datalayer docs', click: 'docs' },
    { label: 'Report a problem', click: 'report' },
    { label: 'GitHub', click: 'github' },
  ];
  if (state.platform !== 'darwin') {
    entries.push(
      { type: 'separator' },
      { label: `About ${state.appName}`, click: 'about' }
    );
  }
  return { label: 'Help', submenu: entries };
}

function appMenu(state: MenuState): MenuEntry {
  const entries: MenuEntry[] = [
    { label: `About ${state.appName}`, click: 'about' },
    { type: 'separator' },
  ];
  if (state.signedIn) {
    entries.push(
      { label: 'Sign out', action: 'sign-out' },
      { type: 'separator' }
    );
  }
  entries.push(
    { label: 'Services', role: 'services', submenu: [] },
    { type: 'separator' },
    { label: `Hide ${state.appName}`, role: 'hide' },
    { label: 'Hide Others', role: 'hideOthers' },
    { label: 'Show All', role: 'unhide' },
    { type: 'separator' },
    { label: 'Quit', click: 'quit', accelerator: 'Command+Q' }
  );
  return { label: state.appName, submenu: entries };
}

/**
 * The menu's template from the state: pure.
 *
 * @param state - What the app is showing and can do.
 *
 * @returns The top-level menus with their entries.
 */
export function menuTemplate(state: MenuState): MenuEntry[] {
  const template =
    state.platform === 'darwin'
      ? [
          appMenu(state),
          sessionsMenu(state),
          editMenu(state),
          fileMenu(state),
          viewMenu(state),
          windowMenu(),
          helpMenu(state),
        ]
      : [
          sessionsMenu(state),
          editMenu(state),
          fileMenu(state),
          viewMenu(state),
          helpMenu(state),
        ];
  return state.signedIn ? template : signedOutTemplate(template, state);
}

/** The app menu's entries that stay enabled when signed out on macOS. */
const SIGNED_OUT_APP_CLICKS: ReadonlySet<MenuClick> = new Set([
  'about',
  'quit',
]);

/**
 * Signed out, nothing but Help is enabled: the app can do nothing for the
 * person before they sign in. Two exceptions the OS asks for on macOS: the
 * app menu keeps About and Quit (the OS needs Quit there, and Command+Q
 * only works through it), and Edit stays enabled, because macOS routes
 * Command+C / Command+V through the Edit menu, and the Login page's fields
 * need paste.
 */
function signedOutTemplate(
  template: MenuEntry[],
  state: MenuState
): MenuEntry[] {
  const darwin = state.platform === 'darwin';
  return template.map(entry => {
    if ('type' in entry || entry.label === 'Help') {
      return entry;
    }
    if (darwin && entry.label === state.appName) {
      return {
        ...entry,
        submenu: (entry.submenu || []).map(item =>
          'type' in item ||
          (item.click && SIGNED_OUT_APP_CLICKS.has(item.click))
            ? item
            : { ...item, enabled: false }
        ),
      };
    }
    if (darwin && entry.label === 'Edit') {
      return entry;
    }
    return { ...entry, enabled: false };
  });
}

/**
 * The actions a template carries, in order (for the tests: what the
 * renderer may be sent).
 *
 * @param entries - A template.
 *
 * @returns The action ids.
 */
export function actionsOf(entries: MenuEntry[]): MenuActionId[] {
  const found: MenuActionId[] = [];
  for (const entry of entries) {
    if ('type' in entry) {
      continue;
    }
    if (entry.action) {
      found.push(entry.action);
    }
    if (entry.submenu) {
      found.push(...actionsOf(entry.submenu));
    }
  }
  return found;
}

// --- the wiring ------------------------------------------------------------

/** The state the menu was last built from. */
let state: MenuState | null = null;

/** Whether the menu follows the local runtimes yet. */
let followingRuntimes = false;

/**
 * The state now: what was last said of sign-in and the session in front,
 * and whether a local runtime runs, asked each time (DK-05's
 * `anyLocalRuntime`).
 */
function currentState(): MenuState {
  if (!state) {
    state = {
      platform: process.platform,
      appName: app.getName(),
      signedIn: false,
      localRuntimeRunning: false,
      sessionInFront: false,
      devTools: shouldEnableDevTools(),
    };
  }
  state = { ...state, localRuntimeRunning: anyLocalRuntime() };
  return state;
}

function clicked(click: MenuClick): void {
  switch (click) {
    case 'about':
      createAboutDialog();
      return;
    case 'quit':
      app.quit();
      return;
    case 'docs':
      shell.openExternal(HELP_URLS.docs);
      return;
    case 'report':
      shell.openExternal(HELP_URLS.report);
      return;
    case 'github':
      shell.openExternal(EXTERNAL_URLS.GITHUB);
      return;
    case 'learn-more':
      shell.openExternal(EXTERNAL_URLS.LEARN_MORE);
      return;
  }
}

function sendAction(action: MenuActionId): void {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', action);
  }
}

function electronEntry(entry: MenuEntry): Electron.MenuItemConstructorOptions {
  if ('type' in entry) {
    return { type: 'separator' };
  }
  const built: Electron.MenuItemConstructorOptions = { label: entry.label };
  if (entry.role) {
    built.role = entry.role as Electron.MenuItemConstructorOptions['role'];
  }
  if (entry.accelerator) {
    built.accelerator = entry.accelerator;
  }
  if (entry.enabled === false) {
    built.enabled = false;
  }
  if (entry.action) {
    const action = entry.action;
    built.click = () => sendAction(action);
  } else if (entry.click) {
    const click = entry.click;
    built.click = () => clicked(click);
  }
  if (entry.submenu) {
    built.submenu = entry.submenu.map(electronEntry);
  }
  return built;
}

/**
 * Builds the application menu from the current state.
 */
export function createMenu(): void {
  if (!followingRuntimes) {
    // A runtime started or stopped (DK-05) shows or hides its stop.
    followingRuntimes = true;
    localRuntimes.onChange(() => createMenu());
  }
  const menu = Menu.buildFromTemplate(
    menuTemplate(currentState()).map(electronEntry)
  );
  Menu.setApplicationMenu(menu);
}

/**
 * Rebuilds the menu with part of the state changed: sign-in and sign-out,
 * a session in front (DK-07); a local runtime started or stopped (DK-05)
 * is read from the runtimes themselves.
 *
 * @param changed - The part that changed.
 */
export function refreshMenu(
  changed: Partial<Pick<MenuState, 'signedIn' | 'sessionInFront'>>
): void {
  state = { ...currentState(), ...changed };
  createMenu();
}
