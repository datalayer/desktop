/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/index
 *
 * Clean main process entry point for the Datalayer Desktop Electron application.
 * Coordinates initialization of all application components and services.
 *
 * Architecture:
 * - Logging configuration and console overrides
 * - Application lifecycle management
 * - IPC handler registration
 * - Service initialization
 */

// Initialize logging FIRST
import { initializeLogging, setupConsoleOverrides } from './config/logging';

// Initialize logging immediately
initializeLogging();
setupConsoleOverrides();

// Core Electron imports
import { ipcMain, shell } from 'electron';

// Application components
import { Application } from './app/application';

// Services
import { apiService } from './services/api-service';
import { websocketProxy } from './services/websocket-proxy';
import { getMainWindow } from './app/window-manager';

// Types
import type {
  VersionInfo,
  EnvironmentVars,
  HTTPRequestConfig,
  WebSocketConfig,
} from './types/api-types';

/**
 * Register all IPC handlers for the application
 */
function registerIPCHandlers(): void {
  // System handlers
  ipcMain.on('open-external', (_, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('get-version', (): VersionInfo => {
    const { app } = require('electron');
    return {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      app: app.getVersion(),
    };
  });

  ipcMain.handle('get-env', (): EnvironmentVars => {
    return {
      DATALAYER_RUN_URL: process.env.DATALAYER_RUN_URL || '',
      DATALAYER_TOKEN: process.env.DATALAYER_TOKEN || '',
    };
  });

  // Authentication handlers
  ipcMain.handle('datalayer:login', async (_, { runUrl, token }) => {
    return apiService.login(runUrl, token);
  });

  ipcMain.handle('datalayer:logout', async () => {
    return apiService.logout();
  });

  ipcMain.handle('datalayer:get-credentials', async () => {
    return await apiService.getCredentialsWithToken();
  });

  // Environment and runtime handlers
  ipcMain.handle('datalayer:get-environments', async () => {
    return apiService.getEnvironments();
  });

  ipcMain.handle('datalayer:create-runtime', async (_, options) => {
    return apiService.createRuntime(options);
  });

  ipcMain.handle('datalayer:delete-runtime', async (_, podName) => {
    return apiService.deleteRuntime(podName);
  });

  ipcMain.handle('datalayer:get-runtime-details', async (_, runtimeId) => {
    return apiService.getRuntimeDetails(runtimeId);
  });

  ipcMain.handle('datalayer:is-runtime-active', async (_, podName) => {
    return apiService.isRuntimeActive(podName);
  });

  ipcMain.handle('datalayer:list-user-runtimes', async () => {
    return apiService.listUserRuntimes();
  });

  // Notebook and document handlers
  ipcMain.handle('datalayer:list-notebooks', async () => {
    return apiService.listNotebooks();
  });

  ipcMain.handle(
    'datalayer:create-notebook',
    async (_, { spaceId, name, description }) => {
      return apiService.createNotebook(spaceId, name, description);
    }
  );

  ipcMain.handle(
    'datalayer:delete-notebook',
    async (_, { spaceId, itemId }) => {
      return apiService.deleteNotebook(spaceId, itemId);
    }
  );

  // Space handlers
  ipcMain.handle('datalayer:get-user-spaces', async () => {
    return apiService.getUserSpaces();
  });

  ipcMain.handle('datalayer:get-space-items', async (_, spaceId: string) => {
    return apiService.getSpaceItems(spaceId);
  });

  // Collaboration handlers
  ipcMain.handle(
    'datalayer:get-collaboration-session',
    async (_, documentId) => {
      return apiService.getCollaborationSessionId(documentId);
    }
  );

  ipcMain.handle('datalayer:get-collaboration-token', async () => {
    return apiService.getCredentialsWithToken();
  });

  // User and GitHub handlers
  ipcMain.handle('datalayer:current-user', async () => {
    return apiService.getCurrentUser();
  });

  ipcMain.handle('datalayer:github-user', async (_, githubId: number) => {
    return apiService.getGitHubUser(githubId);
  });

  // Generic API request handler
  ipcMain.handle('datalayer:request', async (_, { endpoint, options }) => {
    return apiService.makeRequest(endpoint, options);
  });

  // HTTP proxy handlers
  ipcMain.handle('proxy:http-request', async (_, config: HTTPRequestConfig) => {
    const { url, method, headers, body } = config;

    const requestOptions: RequestInit = {
      method: method || 'GET',
      headers: headers || {},
    };

    // Add body if present and method supports it
    if (body && !['GET', 'HEAD'].includes(method || 'GET')) {
      if (body instanceof ArrayBuffer) {
        requestOptions.body = Buffer.from(new Uint8Array(body));
      } else if (body instanceof Uint8Array) {
        requestOptions.body = Buffer.from(body);
      } else if (typeof body === 'object') {
        requestOptions.body = JSON.stringify(body);
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json',
        };
      } else {
        requestOptions.body = body;
      }
    }

    const response = await fetch(url, requestOptions);

    // Get response headers as plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Get response body
    let responseBody: unknown;
    const contentType = response.headers.get('content-type');

    if (!method || method === 'DELETE') {
      responseBody = undefined;
    } else if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType?.includes('text')) {
      responseBody = await response.text();
    } else {
      const buffer = await response.arrayBuffer();
      responseBody = Array.from(new Uint8Array(buffer));
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };
  });

  // WebSocket proxy handlers
  ipcMain.handle('proxy:websocket-open', async (_, config: WebSocketConfig) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      throw new Error('Main window not available');
    }

    const { url, protocol, headers, runtimeId } = config;
    const result = websocketProxy.open(
      mainWindow,
      url,
      protocol,
      headers,
      runtimeId
    );

    // Check if the connection was blocked
    if ('blocked' in result && result.blocked) {
      throw new Error(result.reason);
    }

    return result;
  });

  ipcMain.handle('proxy:websocket-send', async (_, { id, data }) => {
    websocketProxy.send(id, data);
    return { success: true };
  });

  ipcMain.handle('proxy:websocket-close', async (_, { id, code, reason }) => {
    websocketProxy.close(id, code, reason);
    return { success: true };
  });

  ipcMain.handle('proxy:websocket-close-runtime', async (_, { runtimeId }) => {
    websocketProxy.closeConnectionsForRuntime(runtimeId);
    return { success: true };
  });

  // Runtime termination notification handler
  ipcMain.handle('runtime-terminated', async (_, { runtimeId }) => {
    // Initialize global cleanup registry in main process
    if (!(global as any).__datalayerRuntimeCleanup) {
      (global as any).__datalayerRuntimeCleanup = new Map();
    }

    const cleanupRegistry = (global as any).__datalayerRuntimeCleanup;
    cleanupRegistry.set(runtimeId, { terminated: true });

    // Close all WebSocket connections for this runtime
    try {
      websocketProxy.closeConnectionsForRuntime(runtimeId);
    } catch (error) {
      // Error closing WebSocket connections
    }

    return { success: true };
  });
}

/**
 * Main application initialization
 */
async function main(): Promise<void> {
  try {
    // Register all IPC handlers
    registerIPCHandlers();

    // Set up application event handlers
    Application.setupEventHandlers();

    // Initialize the application
    await Application.initialize();

    console.log('Datalayer Desktop application started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
main();
