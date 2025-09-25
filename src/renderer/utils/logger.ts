/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/utils/logger
 *
 * Centralized logging utility for the renderer process using electron-log.
 * Provides module-specific loggers with configurable levels based on environment.
 *
 * Features:
 * - Environment-aware log levels (debug in development, info in production)
 * - Module-specific scoped loggers for better organization
 * - Global window access for development debugging
 *
 * Available loggers:
 * - apiLogger: API communication logging
 * - proxyLogger: HTTP/WebSocket proxy logging
 * - runtimeLogger: Runtime lifecycle logging
 * - notebookLogger: Notebook operations logging
 * - collaborationLogger: Real-time collaboration logging
 */

import log from 'electron-log/renderer';

// Configure electron-log for renderer process
log.transports.console.level =
  process.env.NODE_ENV === 'development' ? 'debug' : 'info';

// Create module-specific loggers
export const apiLogger = log.scope('api');
export const proxyLogger = log.scope('proxy');
export const runtimeLogger = log.scope('runtime');
export const notebookLogger = log.scope('notebook');
export const collaborationLogger = log.scope('collaboration');

// Default logger
export const logger = log;

// Make available globally for dev tools debugging
if (typeof window !== 'undefined') {
  (window as any).logger = log;
}
