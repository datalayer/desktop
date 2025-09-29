/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/polyfills/jupyterlab-proxy
 *
 * JupyterLab services proxy module.
 * Handles CommonJS/ESM module resolution issues and provides
 * proper exports for @jupyterlab/services in production builds.
 */

/**
 * Proxy module for @jupyterlab/services
 * Properly handles CommonJS/ESM interop
 */

// Import everything from the main index.js to avoid circular dependency
// The Vite plugin redirects '@jupyterlab/services' to this file, so we can't import it
// Instead, import from the lib/index.js which re-exports everything
import * as servicesModule from '@jupyterlab/services/lib/index.js';

// Handle the fact that Vite may wrap CommonJS modules
let services = servicesModule;

// Debug: check what we actually got

// If there's only one key, it might be the default export wrapper
if (Object.keys(servicesModule).length === 1) {
  const key = Object.keys(servicesModule)[0];
  // Single key found

  // Handle __require wrapper (Vite's CommonJS interop)
  if (key === '__require' && typeof servicesModule[key] === 'function') {
    // Found __require wrapper, trying to load module
    try {
      // Try to use the __require function to load the actual module
      const actualModule = servicesModule.__require(
        '@jupyterlab/services/lib/index.js'
      );
      // Check __require result

      if (actualModule && actualModule.ServiceManager) {
        // Found ServiceManager via __require
        services = actualModule;
      }
    } catch (e) {
      // Failed to use __require
    }
  }
  // Check if it's 'default' or another wrapper
  else if (key === 'default' || typeof servicesModule[key] === 'object') {
    const candidate = servicesModule[key];
    // Check candidate keys

    // Check if this has what we need
    if (candidate && candidate.ServiceManager) {
      // Found ServiceManager in wrapped module
      services = candidate;
    }
  }
}

// If we got a default export (CommonJS interop), use it
if (
  !services.ServiceManager &&
  servicesModule.default &&
  typeof servicesModule.default === 'object'
) {
  // Trying default export from servicesModule
  services = servicesModule.default;
}

// Import namespaces separately as they may not be on the main export
import * as Kernel from '@jupyterlab/services/lib/kernel/index.js';
import * as KernelMessage from '@jupyterlab/services/lib/kernel/messages.js';
import * as Session from '@jupyterlab/services/lib/session/index.js';
import * as Contents from '@jupyterlab/services/lib/contents/index.js';
import * as Terminal from '@jupyterlab/services/lib/terminal/index.js';
import * as Setting from '@jupyterlab/services/lib/setting/index.js';
import * as Workspace from '@jupyterlab/services/lib/workspace/index.js';
import * as Event from '@jupyterlab/services/lib/event/index.js';
import * as Nbconvert from '@jupyterlab/services/lib/nbconvert/index.js';
import * as KernelSpec from '@jupyterlab/services/lib/kernelspec/index.js';
import * as User from '@jupyterlab/services/lib/user/index.js';

// Import specific sub-module exports
import * as KernelAPI from '@jupyterlab/services/lib/kernel/restapi.js';
import { KernelConnection } from '@jupyterlab/services/lib/kernel/kernel.js';
import * as KernelSpecAPI from '@jupyterlab/services/lib/kernelspec/restapi.js';

// Import IConfigSectionManager interface from tokens
import { IConfigSectionManager } from '@jupyterlab/services/lib/tokens.js';

// Try direct imports as a fallback if the module wrapping failed
let ServiceManager,
  ServerConnection,
  SessionManager,
  KernelManager,
  ContentsManager,
  TerminalManager,
  SettingManager,
  WorkspaceManager,
  EventManager,
  NbConvertManager,
  KernelSpecManager,
  UserManager,
  BuildManager,
  BaseManager,
  ConfigSection,
  ConfigSectionManager,
  ConfigWithDefaults,
  ConnectionStatus,
  Drive,
  RestContentProvider;

// Try to get from services first
if (services && services.ServiceManager) {
  ServiceManager = services.ServiceManager;
  ServerConnection = services.ServerConnection;
  SessionManager = services.SessionManager;
  KernelManager = services.KernelManager;
  ContentsManager = services.ContentsManager;
  TerminalManager = services.TerminalManager;
  SettingManager = services.SettingManager;
  WorkspaceManager = services.WorkspaceManager;
  EventManager = services.EventManager;
  NbConvertManager = services.NbConvertManager;
  KernelSpecManager = services.KernelSpecManager;
  UserManager = services.UserManager;
  BuildManager = services.BuildManager;
  BaseManager = services.BaseManager;
  ConfigSection = services.ConfigSection;
  ConfigSectionManager = services.ConfigSectionManager;
  ConfigWithDefaults = services.ConfigWithDefaults;
  ConnectionStatus = services.ConnectionStatus;
  Drive = services.Drive;
  RestContentProvider = services.RestContentProvider;
} else {
  // If that didn't work, try importing individual modules directly
  // Services module not properly loaded, trying direct imports

  // Import individual manager modules - use dynamic imports in async IIFE
  (async () => {
    const managerModule = await import('@jupyterlab/services/lib/manager.js');
    const serverConnectionModule = await import(
      '@jupyterlab/services/lib/serverconnection.js'
    );
    const baseManagerModule = await import(
      '@jupyterlab/services/lib/basemanager.js'
    );
    const connectionStatusModule = await import(
      '@jupyterlab/services/lib/connectionstatus.js'
    );

    // Check managerModule

    // Handle __require wrapper for individual modules
    if (
      managerModule.__require &&
      typeof managerModule.__require === 'function'
    ) {
      // Using __require for manager.js
      try {
        const actualManager = managerModule.__require(
          '@jupyterlab/services/lib/manager.js'
        );
        // Check actualManager
        ServiceManager =
          actualManager?.ServiceManager ||
          actualManager?.default ||
          actualManager;
      } catch (e) {
        // Failed to __require manager.js
      }
    } else {
      // Extract from modules (handle both named and default exports)
      ServiceManager =
        managerModule.ServiceManager ||
        managerModule.default?.ServiceManager ||
        managerModule.default;
    }

    // Handle __require wrapper for serverconnection
    if (
      serverConnectionModule.__require &&
      typeof serverConnectionModule.__require === 'function'
    ) {
      try {
        const actualServerConnection = serverConnectionModule.__require(
          '@jupyterlab/services/lib/serverconnection.js'
        );
        ServerConnection =
          actualServerConnection?.ServerConnection ||
          actualServerConnection?.default ||
          actualServerConnection;
      } catch (e) {
        // Failed to __require serverconnection.js
      }
    } else {
      ServerConnection =
        serverConnectionModule.ServerConnection ||
        serverConnectionModule.default?.ServerConnection ||
        serverConnectionModule.default;
    }

    // Handle other modules similarly
    if (baseManagerModule.__require) {
      try {
        const actualBaseManager = baseManagerModule.__require(
          '@jupyterlab/services/lib/basemanager.js'
        );
        BaseManager =
          actualBaseManager?.BaseManager ||
          actualBaseManager?.default ||
          actualBaseManager;
      } catch (e) {
        // Failed to __require basemanager.js
      }
    } else {
      BaseManager =
        baseManagerModule.BaseManager ||
        baseManagerModule.default?.BaseManager ||
        baseManagerModule.default;
    }

    if (connectionStatusModule.__require) {
      try {
        const actualConnectionStatus = connectionStatusModule.__require(
          '@jupyterlab/services/lib/connectionstatus.js'
        );
        ConnectionStatus =
          actualConnectionStatus?.ConnectionStatus ||
          actualConnectionStatus?.default ||
          actualConnectionStatus;
      } catch (e) {
        // Failed to __require connectionstatus.js
      }
    } else {
      ConnectionStatus =
        connectionStatusModule.ConnectionStatus ||
        connectionStatusModule.default?.ConnectionStatus ||
        connectionStatusModule.default;
    }

    // For the rest, use the already imported namespaces
    SessionManager = Session.SessionManager || Session.default?.SessionManager;
    KernelManager = Kernel.KernelManager || Kernel.default?.KernelManager;
    ContentsManager =
      Contents.ContentsManager || Contents.default?.ContentsManager;
    Drive = Contents.Drive || Contents.default?.Drive;
    RestContentProvider =
      Contents.RestContentProvider || Contents.default?.RestContentProvider;
    TerminalManager =
      Terminal.TerminalManager || Terminal.default?.TerminalManager;
    SettingManager = Setting.SettingManager;
    WorkspaceManager = Workspace.WorkspaceManager;
    EventManager = Event.EventManager;
    NbConvertManager = Nbconvert.NbConvertManager;
    KernelSpecManager = KernelSpec.KernelSpecManager;
    UserManager = User.UserManager;
    BuildManager = servicesModule.BuildManager; // This might not exist
    ConfigSection = servicesModule.ConfigSection;
    ConfigSectionManager = servicesModule.ConfigSectionManager;
    ConfigWithDefaults = servicesModule.ConfigWithDefaults;
  })();
}

// Check what we imported for debugging

// Verify critical imports
if (!ServiceManager) {
  // ServiceManager not found
  throw new Error('Failed to import ServiceManager from @jupyterlab/services');
}

// Re-export everything
export {
  ServiceManager,
  ServerConnection,
  SessionManager,
  KernelManager,
  ContentsManager,
  TerminalManager,
  SettingManager,
  WorkspaceManager,
  EventManager,
  NbConvertManager,
  KernelSpecManager,
  UserManager,
  BuildManager,
  BaseManager,
  ConfigSection,
  ConfigSectionManager,
  IConfigSectionManager,
  ConfigWithDefaults,
  ConnectionStatus,
  Drive,
  RestContentProvider,

  // Namespaces
  Kernel,
  KernelMessage,
  Session,
  Contents,
  Terminal,
  Setting,
  Workspace,
  Event,
  Nbconvert,
  KernelSpec,
  User,

  // Sub-module exports
  KernelAPI,
  KernelConnection,
  KernelSpecAPI,
};

// Proxy setup complete
