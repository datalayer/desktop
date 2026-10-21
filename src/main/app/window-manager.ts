/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Window creation and management for the Electron application.
 * Handles main window configuration, security settings, and event handlers.
 *
 * @module main/app/window-manager
 */

import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import {
  shouldEnableDevTools,
  shouldUseProductionSecurity,
} from './environment';
import { setupContentSecurityPolicy } from './security-manager';
import { WINDOW_CONFIG } from '../config/constants';

/**
 * The main application window instance.
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Get the main window instance.
 * @returns The main window or null if closed
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Creates the main application window with security configurations.
 * Sets up window properties, CSP, and event handlers.
 */
export function createWindow(): void {
  // Disable sandbox on Linux in development to avoid SUID configuration issues
  // Production builds still use full sandboxing for security
  const isLinux = process.platform === 'linux';
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const shouldDisableSandbox = isLinux && isDevelopment;

  mainWindow = new BrowserWindow({
    width: WINDOW_CONFIG.WIDTH,
    height: WINDOW_CONFIG.HEIGHT,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: shouldEnableDevTools(), // Disable DevTools in pure production
      sandbox: !shouldDisableSandbox, // Disable sandbox on Linux in dev mode
    },
    icon: join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Set Content Security Policy
  setupContentSecurityPolicy();

  // Load the app
  if (process.env.ELECTRON_RENDERER_URL) {
    // Development mode
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    // Only open DevTools if allowed by environment settings
    if (shouldEnableDevTools()) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    // Production mode
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Set up security features
  setupWindowSecurity();
}

/**
 * Set up security features for the main window.
 * Disables DevTools shortcuts and context menu in production.
 */
function setupWindowSecurity(): void {
  if (!mainWindow || !shouldUseProductionSecurity()) {
    return;
  }

  // Disable DevTools keyboard shortcuts in production
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Disable common DevTools shortcuts
    if (
      ((input.control || input.meta) &&
        input.shift &&
        input.key.toLowerCase() === 'i') || // Ctrl/Cmd+Shift+I
      (input.shift && input.key.toLowerCase() === 'c') || // Ctrl/Cmd+Shift+C
      (input.shift && input.key.toLowerCase() === 'j') || // Ctrl/Cmd+Shift+J
      input.key === 'F12'
    ) {
      event.preventDefault();
    }
  });

  // Disable right-click context menu in production
  mainWindow.webContents.on('context-menu', event => {
    event.preventDefault();
  });
}
