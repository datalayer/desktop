/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Application lifecycle management for the Electron application.
 * Handles app startup, window management, and shutdown procedures.
 *
 * @module main/app/application
 */

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { createWindow } from './window-manager';
import { createMenu } from './menu-manager';

/**
 * Application lifecycle manager.
 * Coordinates app initialization, window management, and event handlers.
 */
export class Application {
  /**
   * Initialize the application when ready.
   * Sets up platform-specific configurations and creates the main window.
   */
  static async initialize(): Promise<void> {
    await app.whenReady();

    // Increase max event listeners to prevent warnings
    require('events').EventEmitter.defaultMaxListeners = 20;

    // Disable system beep sounds
    if (process.platform === 'darwin') {
      // Disable beep sound on macOS
      app.commandLine.appendSwitch('disable-renderer-accessibility');
    }

    // Set the dock icon on macOS
    if (process.platform === 'darwin') {
      const iconPath = join(__dirname, '../../resources/icon.png');
      app.dock.setIcon(iconPath);
    }

    createWindow();
    createMenu();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  }

  /**
   * Set up application event handlers.
   * Configures window lifecycle and security behaviors.
   */
  static setupEventHandlers(): void {
    // Quit app on non-macOS platforms when all windows are closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Security handler: prevent new window creation, open external links in browser
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
      });
    });
  }
}
