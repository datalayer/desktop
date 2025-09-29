/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/config/logging
 *
 * Logging configuration and console overrides for the main process.
 * Configures electron-log and provides safe console methods that prevent
 * EPIPE errors in production builds.
 */

// Initialize electron-log FIRST, before any other imports
import log from 'electron-log/main';

/**
 * Configure electron-log for main process
 */
export function initializeLogging(): void {
  log.initialize();
  log.transports.file.level = 'info';
  // Disable console transport in production to avoid EPIPE errors
  log.transports.console.level =
    process.env.NODE_ENV === 'development' ? 'debug' : false;
}

/**
 * Set up safe console overrides to prevent EPIPE errors.
 * EPIPE errors occur when the console output pipe is broken in production.
 */
export function setupConsoleOverrides(): void {
  // Original console functions are preserved for potential future use
  // const _originalConsoleLog = console.log;
  // const _originalConsoleError = console.error;
  // const _originalConsoleWarn = console.warn;

  /**
   * Override console.log to use electron-log to prevent EPIPE errors.
   * @param args - Arguments to log
   */
  console.log = (...args: any[]) => {
    try {
      log.info(...args);
    } catch (e: any) {
      // Silently ignore EPIPE errors
    }
  };

  /**
   * Override console.error to use electron-log to prevent EPIPE errors.
   * @param args - Arguments to log as errors
   */
  console.error = (...args: any[]) => {
    try {
      log.error(...args);
    } catch (e: any) {
      // Silently ignore EPIPE errors
    }
  };

  /**
   * Override console.warn to use electron-log to prevent EPIPE errors.
   * @param args - Arguments to log as warnings
   */
  console.warn = (...args: any[]) => {
    try {
      log.warn(...args);
    } catch (e: any) {
      // Silently ignore EPIPE errors
    }
  };
}
