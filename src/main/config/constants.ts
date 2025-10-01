/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Application constants and configuration values.
 * Centralizes commonly used values across the main process.
 *
 * @module main/config/constants
 */

/**
 * Default window dimensions.
 */
export const WINDOW_CONFIG = {
  WIDTH: 1400,
  HEIGHT: 900,
} as const;

/**
 * About dialog dimensions.
 */
export const ABOUT_DIALOG_CONFIG = {
  WIDTH: 450,
  HEIGHT: 600,
} as const;

/**
 * Application URLs and external links.
 */
export const EXTERNAL_URLS = {
  LEARN_MORE: 'https://datalayer.io',
  DOCUMENTATION: 'https://docs.datalayer.io',
  GITHUB: 'https://github.com/datalayer/core',
} as const;
