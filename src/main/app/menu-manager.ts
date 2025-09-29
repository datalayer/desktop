/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/app/menu-manager
 *
 * Application menu bar creation and management.
 * Provides platform-specific menu structures with proper event handlers.
 */

import { app, Menu, shell } from 'electron';
import { shouldEnableDevTools } from './environment';
import { createAboutDialog } from '../dialogs/about/about-dialog';
import { EXTERNAL_URLS } from '../config/constants';

/**
 * Creates the application menu bar.
 * Different menu structures for macOS and non-macOS platforms.
 * Includes File, Edit, View, Window, and Help menus with appropriate items.
 * @returns void
 */
export function createMenu(): void {
  if (process.platform === 'darwin') {
    createMacOSMenu();
  } else {
    createNonMacOSMenu();
  }
}

/**
 * Create macOS-specific menu structure
 */
function createMacOSMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        {
          label: 'About ' + app.getName(),
          click: () => {
            createAboutDialog();
          },
        },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'Hide ' + app.getName(), role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    createEditMenu(),
    createViewMenu(),
    createWindowMenu(),
    createHelpMenu(),
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Create non-macOS menu structure
 */
function createNonMacOSMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    createFileMenu(),
    createEditMenu(),
    createViewMenu(),
    createHelpMenu(),
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Create File menu for non-macOS platforms
 */
function createFileMenu(): Electron.MenuItemConstructorOptions {
  return {
    label: 'File',
    submenu: [
      {
        label: 'Quit',
        accelerator: 'Ctrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  };
}

/**
 * Create Edit menu (common for all platforms)
 */
function createEditMenu(): Electron.MenuItemConstructorOptions {
  const editSubmenu: Electron.MenuItemConstructorOptions[] = [
    { label: 'Undo', role: 'undo' },
    { label: 'Redo', role: 'redo' },
    { type: 'separator' },
    { label: 'Cut', role: 'cut' },
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
  ];

  // Add macOS-specific items
  if (process.platform === 'darwin') {
    editSubmenu.push(
      { label: 'Paste and Match Style', role: 'pasteAndMatchStyle' },
      { label: 'Delete', role: 'delete' },
      { label: 'Select All', role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
      }
    );
  } else {
    editSubmenu.push(
      { label: 'Delete', role: 'delete' },
      { label: 'Select All', role: 'selectAll' }
    );
  }

  return {
    label: 'Edit',
    submenu: editSubmenu,
  };
}

/**
 * Create View menu (common for all platforms)
 */
function createViewMenu(): Electron.MenuItemConstructorOptions {
  const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
    { label: 'Reload', role: 'reload' },
    { label: 'Force Reload', role: 'forceReload' },
  ];

  // Add DevTools option if enabled
  if (shouldEnableDevTools()) {
    viewSubmenu.push(
      {
        label: 'Toggle Developer Tools',
        role: 'toggleDevTools',
      },
      { type: 'separator' }
    );
  }

  viewSubmenu.push(
    { label: 'Actual Size', role: 'resetZoom' },
    { label: 'Zoom In', role: 'zoomIn' },
    { label: 'Zoom Out', role: 'zoomOut' },
    { type: 'separator' },
    { label: 'Toggle Fullscreen', role: 'togglefullscreen' }
  );

  return {
    label: 'View',
    submenu: viewSubmenu,
  };
}

/**
 * Create Window menu (macOS only)
 */
function createWindowMenu(): Electron.MenuItemConstructorOptions {
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

/**
 * Create Help menu (common for all platforms)
 */
function createHelpMenu(): Electron.MenuItemConstructorOptions {
  return {
    label: 'Help',
    submenu: [
      {
        label: 'Learn More',
        click: () => {
          shell.openExternal(EXTERNAL_URLS.LEARN_MORE);
        },
      },
      {
        label: 'Documentation',
        click: () => {
          shell.openExternal(EXTERNAL_URLS.DOCUMENTATION);
        },
      },
      {
        label: 'GitHub',
        click: () => {
          shell.openExternal(EXTERNAL_URLS.GITHUB);
        },
      },
    ],
  };
}
