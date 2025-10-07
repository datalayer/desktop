/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * About dialog creation and management.
 * Handles the modal about window with secure event handling.
 *
 * @module main/dialogs/about/about-dialog
 */

import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { shouldEnableDevTools } from '../../app/environment';
import { getMainWindow } from '../../app/window-manager';
import { ABOUT_DIALOG_CONFIG } from '../../config/constants';

/**
 * Create and show the About dialog.
 */
export function createAboutDialog(): void {
  const mainWindow = getMainWindow();

  const aboutWindow = new BrowserWindow({
    width: ABOUT_DIALOG_CONFIG.WIDTH,
    height: ABOUT_DIALOG_CONFIG.HEIGHT,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/about.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      devTools: shouldEnableDevTools(), // Disable DevTools in production
    },
    parent: mainWindow || undefined,
    modal: true,
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });

  // Load the custom about page
  aboutWindow.loadFile(join(__dirname, 'about.html'));

  // Remove menu from about window
  aboutWindow.setMenu(null);

  // Set up event handlers
  setupAboutDialogHandlers(aboutWindow);
}

/**
 * Set up event handlers for the about dialog.
 * Configures ESC key closing and IPC communication with proper cleanup.
 */
function setupAboutDialogHandlers(aboutWindow: BrowserWindow): void {
  // Store webContents reference before it can be destroyed
  const webContents = aboutWindow.webContents;

  // Create named handlers for proper cleanup
  const escapeHandler = (_event: Electron.Event, input: Electron.Input) => {
    if (input.key === 'Escape' && !aboutWindow.isDestroyed()) {
      aboutWindow.close();
    }
  };

  const closeHandler = () => {
    if (aboutWindow && !aboutWindow.isDestroyed()) {
      aboutWindow.close();
    }
  };

  // Allow closing with ESC key
  webContents.on('before-input-event', escapeHandler);

  // Handle close button click from renderer
  ipcMain.on('close-about-window', closeHandler);

  // Clean up all event listeners BEFORE window is destroyed (use 'close' not 'closed')
  aboutWindow.once('close', () => {
    // Remove the before-input-event listener
    if (webContents && !webContents.isDestroyed()) {
      webContents.removeListener('before-input-event', escapeHandler);
    }
    // Remove the IPC listener
    ipcMain.removeListener('close-about-window', closeHandler);
  });
}
