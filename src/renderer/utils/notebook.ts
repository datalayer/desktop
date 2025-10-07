/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Notebook content parsing and validation utilities.
 *
 * @module renderer/utils/notebook
 */

import React from 'react';
import { INotebookContent } from '@jupyterlab/nbformat';
import type { ServiceManager } from '@jupyterlab/services';
import type { ElectronCollaborationProvider } from '../services/electronCollaborationProvider';

/**
 * Parse notebook content from API response.
 * @param responseBody - Raw API response data
 * @returns Parsed notebook content or null if invalid
 */
export const parseNotebookContent = (
  responseBody: unknown
): INotebookContent => {
  let content;

  if (typeof responseBody === 'string') {
    try {
      content = JSON.parse(responseBody);
    } catch {
      throw new Error('Invalid JSON response from server');
    }
  } else if (
    Array.isArray(responseBody) &&
    typeof responseBody[0] === 'number'
  ) {
    // Handle case where response.body is a byte array
    try {
      const jsonString = String.fromCharCode(...responseBody);
      content = JSON.parse(jsonString);
    } catch {
      throw new Error('Failed to parse notebook content from byte array');
    }
  } else {
    content = responseBody;
  }

  return content;
};

/**
 * Validate notebook content structure.
 * @param content - Content to validate
 * @returns True if valid notebook structure
 */
export const validateNotebookContent = (content: unknown): boolean => {
  if (
    content &&
    typeof content === 'object' &&
    'cells' in content &&
    Array.isArray(content.cells) &&
    'nbformat' in content
  ) {
    return true;
  }

  return false;
};

/**
 * Check if runtime was recently terminated.
 * @param notebookId - Notebook ID
 * @returns True if runtime was terminated
 */
export const isRuntimeTerminated = (notebookId: string): boolean => {
  const wasTerminated = sessionStorage.getItem(
    `notebook-${notebookId}-terminated`
  );
  return wasTerminated === 'true';
};

/**
 * Mark runtime as terminated in session storage.
 * @param notebookId - Notebook ID
 */
export const markRuntimeTerminated = (notebookId: string): void => {
  sessionStorage.setItem(`notebook-${notebookId}-terminated`, 'true');
};

/**
 * Clear runtime termination flag.
 * @param notebookId - Notebook ID
 */
export const clearRuntimeTerminationFlag = (notebookId: string): void => {
  sessionStorage.removeItem(`notebook-${notebookId}-terminated`);
};

/**
 * Check if runtime is marked as terminated in global cleanup registry.
 * @param runtimeId - Runtime ID
 * @returns True if in cleanup registry
 */
export const isRuntimeInCleanupRegistry = (runtimeId: string): boolean => {
  const cleanupRegistry = window.__datalayerRuntimeCleanup;

  if (cleanupRegistry && runtimeId && cleanupRegistry.has(runtimeId)) {
    const entry = cleanupRegistry.get(runtimeId);
    if (entry?.terminated) {
      return true;
    }
  }

  return false;
};

/**
 * Create a stable notebook key for collaboration
 */
export const createStableNotebookKey = (
  notebookId?: string,
  notebookPath?: string,
  notebookName?: string
): string => {
  // Must use the notebook's UID as the ID when collaboration is enabled
  // This is what gets passed as documentId to the collaboration provider
  if (notebookId) {
    return notebookId;
  }

  // Fallback to path if no ID available
  const path = notebookPath || `${notebookName || 'untitled'}.ipynb`;
  return path;
};

/**
 * Get service manager cache key
 */
export const getServiceManagerCacheKey = (runtimeId: string): string => {
  return `serviceManager-${runtimeId}`;
};

/**
 * Get cached service manager
 */
export const getCachedServiceManager = (
  runtimeId: string
): ServiceManager.IManager | undefined => {
  const cacheKey = getServiceManagerCacheKey(
    runtimeId
  ) as `serviceManager-${string}`;
  return window[cacheKey];
};

/**
 * Cache service manager
 */
export const cacheServiceManager = (
  runtimeId: string,
  manager: ServiceManager.IManager
): void => {
  const cacheKey = getServiceManagerCacheKey(
    runtimeId
  ) as `serviceManager-${string}`;
  window[cacheKey] = manager;
};

/**
 * Remove service manager from cache
 */
export const removeCachedServiceManager = (runtimeId: string): void => {
  const cacheKey = getServiceManagerCacheKey(
    runtimeId
  ) as `serviceManager-${string}`;
  delete window[cacheKey];
};

/**
 * Safely dispose a service manager
 */
export const safelyDisposeServiceManager = (
  manager: ServiceManager.IManager | null
): void => {
  try {
    if (
      manager &&
      typeof manager.dispose === 'function' &&
      !manager.isDisposed
    ) {
      manager.dispose();
    }
  } catch {
    // Error disposing service manager
  }
};

/**
 * Format error message for display
 */
export const formatErrorMessage = (error: Error): string => {
  const errorMessage = error.message;

  if (errorMessage.includes('Failed to create runtime')) {
    return 'Datalayer runtime service is temporarily unavailable. Please try again later.';
  } else if (errorMessage.includes('Server Error')) {
    return 'Datalayer infrastructure is experiencing issues. Please try again later.';
  } else {
    return 'Failed to initialize notebook environment';
  }
};

/**
 * Create notebook props for Notebook2 component
 */
export const createNotebookProps = (
  stableNotebookKey: string,
  notebookContent: INotebookContent,
  serviceManager: ServiceManager.IManager,
  collaborationProvider: ElectronCollaborationProvider | null,
  extensions: unknown[],
  Toolbar?: React.ComponentType<unknown>
) => {
  const hasCollaboration = !!collaborationProvider;

  return {
    id: stableNotebookKey,
    height: '100%' as const,
    // When using collaboration, don't pass nbformat - let collaboration load it
    nbformat: hasCollaboration ? undefined : notebookContent,
    readonly: false,
    serviceManager: serviceManager,
    startDefaultKernel: false,
    collaborative: hasCollaboration,
    collaborationEnabled: hasCollaboration,
    collaborationProvider: collaborationProvider || undefined,
    extensions: extensions,
    cellSidebarMargin: 60,
    Toolbar: Toolbar,
  };
};

/**
 * Log notebook component information
 */
export const logNotebookInfo = (
  _serviceManager: ServiceManager.IManager | null,
  _notebookContent: INotebookContent | null,
  _collaborationProvider: ElectronCollaborationProvider | null,
  _notebookId?: string
) => {
  // Notebook component information logging function (logging removed)
};
