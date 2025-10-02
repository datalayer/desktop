/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Mock implementations for Electron APIs used in tests.
 * Provides mock IPC, app, and other Electron modules.
 *
 * @module tests/mocks/electron
 */

import { vi } from 'vitest';

/**
 * Mock for electron module (main process).
 */
export const electronMock = {
  app: {
    getName: vi.fn(() => 'Datalayer Desktop'),
    getVersion: vi.fn(() => '0.0.1'),
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/tmp/test-user-data',
        appData: '/tmp/test-app-data',
        home: '/tmp/test-home',
        temp: '/tmp',
      };
      return paths[name] || '/tmp';
    }),
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    isReady: vi.fn(() => true),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  },

  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeHandler: vi.fn(),
    removeListener: vi.fn(),
  },

  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },

  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(() => Promise.resolve()),
    loadFile: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    once: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn(),
      isDevToolsOpened: vi.fn(() => false),
      on: vi.fn(),
      once: vi.fn(),
      isDestroyed: vi.fn(() => false),
    },
    isDestroyed: vi.fn(() => false),
    close: vi.fn(),
    destroy: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    isFocused: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    isMinimized: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    setSize: vi.fn(),
    getSize: vi.fn(() => [1024, 768]),
    setPosition: vi.fn(),
    getPosition: vi.fn(() => [0, 0]),
    center: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    setFullScreen: vi.fn(),
  })),

  shell: {
    openExternal: vi.fn(() => Promise.resolve()),
    openPath: vi.fn(() => Promise.resolve('')),
    showItemInFolder: vi.fn(),
    trashItem: vi.fn(() => Promise.resolve()),
  },

  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: [] })),
    showSaveDialog: vi.fn(() => Promise.resolve({ canceled: false, filePath: '' })),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
    showErrorBox: vi.fn(),
  },

  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((plainText: string) => Buffer.from(plainText, 'utf8')),
    decryptString: vi.fn((encrypted: Buffer) => encrypted.toString('utf8')),
  },

  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn(),
    getApplicationMenu: vi.fn(() => null),
  },
};

/**
 * Mock for contextBridge (preload process).
 */
export const contextBridgeMock = {
  exposeInMainWorld: vi.fn(),
};

/**
 * Setup Electron mocks for tests.
 * Call this in test files that need Electron APIs.
 */
export function setupElectronMocks() {
  vi.mock('electron', () => electronMock);
  vi.mock('electron/main', () => electronMock);
  vi.mock('electron/renderer', () => ({
    ipcRenderer: electronMock.ipcRenderer,
  }));
}

/**
 * Reset all Electron mocks.
 */
export function resetElectronMocks() {
  Object.values(electronMock).forEach((mock: any) => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach((fn: any) => {
        if (vi.isMockFunction(fn)) {
          fn.mockClear();
        }
      });
    }
  });
}
