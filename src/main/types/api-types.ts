/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/types/api-types
 *
 * Type definitions for API requests and responses.
 * Defines interfaces used by the API service and IPC handlers.
 */

/**
 * Version information returned by the application
 */
export interface VersionInfo {
  electron: string;
  node: string;
  chrome: string;
  app: string;
}

/**
 * Environment variables exposed to renderer
 */
export interface EnvironmentVars {
  DATALAYER_RUN_URL: string;
  DATALAYER_TOKEN: string;
}

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Login request parameters
 */
export interface LoginRequest {
  runUrl: string;
  token: string;
}

/**
 * Runtime creation options
 */
export interface RuntimeCreateOptions {
  environment?: string;
  name?: string;
  description?: string;
}

/**
 * Notebook creation parameters
 */
export interface NotebookCreateRequest {
  spaceId: string;
  name: string;
  description?: string;
}

/**
 * HTTP request configuration for proxy
 */
export interface HTTPRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * WebSocket connection configuration
 */
export interface WebSocketConfig {
  url: string;
  protocol?: string;
  headers?: Record<string, string>;
  runtimeId?: string;
}
