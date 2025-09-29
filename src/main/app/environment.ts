/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/app/environment
 *
 * Environment detection utilities for the Electron application.
 * Provides functions to determine the current runtime environment
 * and configure environment-specific behaviors.
 */

/**
 * Checks if the application is running in development mode.
 * @returns True if NODE_ENV is 'development', false otherwise
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Determines whether DevTools should be enabled.
 * Currently always returns true for debugging purposes.
 * @returns True to enable DevTools
 */
export function shouldEnableDevTools(): boolean {
  // Always enable DevTools on all builds
  return true;
}

/**
 * Determines whether production security features should be enabled.
 * @returns True if running in production mode
 */
export function shouldUseProductionSecurity(): boolean {
  return !isDevelopment();
}
