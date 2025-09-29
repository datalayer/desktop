/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/types/app-types
 *
 * Type definitions for the main Electron application.
 * Defines interfaces and types used across the main process.
 */

import { BrowserWindow } from 'electron';

/**
 * Configuration for creating application windows
 */
export interface WindowConfig {
  width: number;
  height: number;
  show?: boolean;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  modal?: boolean;
  parent?: BrowserWindow;
}

/**
 * Menu item configuration for cross-platform menus
 */
export interface MenuItemConfig {
  label: string;
  accelerator?: string;
  role?: string;
  click?: () => void;
  type?: 'separator';
  submenu?: MenuItemConfig[];
}
