/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Logging configuration and console overrides for the main process.
 * Configures electron-log and provides safe console methods that prevent EPIPE errors.
 *
 * @module main/config/logging
 */

import log from 'electron-log/main';

/**
 * Configure electron-log for main process.
 * Disables console transport in production to avoid EPIPE errors.
 */
export function initializeLogging(): void {
  log.initialize();
  log.transports.file.level = 'info';
  log.transports.console.level =
    process.env.NODE_ENV === 'development' ? 'debug' : false;
}

/**
 * Set up safe console overrides to prevent EPIPE errors.
 * EPIPE errors occur when the console output pipe is broken in production.
 */
export function setupConsoleOverrides(): void {
  console.log = (...args: unknown[]) => {
    try {
      log.info(...args);
    } catch {
      // Silently ignore EPIPE errors
    }
  };

  console.error = (...args: unknown[]) => {
    try {
      log.error(...args);
    } catch {
      // Silently ignore EPIPE errors
    }
  };

  console.warn = (...args: unknown[]) => {
    try {
      log.warn(...args);
    } catch {
      // Silently ignore EPIPE errors
    }
  };
}
