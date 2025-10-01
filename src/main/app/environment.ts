/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Environment detection utilities for the Electron application.
 * Provides functions to determine runtime environment and configure behaviors.
 *
 * @module main/app/environment
 */

/**
 * Checks if the application is running in development mode.
 * @returns True if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Determines whether DevTools should be enabled.
 * @returns Always true for debugging purposes
 */
export function shouldEnableDevTools(): boolean {
  return true;
}

/**
 * Determines whether production security features should be enabled.
 * @returns True in production mode
 */
export function shouldUseProductionSecurity(): boolean {
  return !isDevelopment();
}
