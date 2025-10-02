/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

import { ILifecycle } from './ILifecycle';

/**
 * Environment information from Datalayer API.
 */
export interface Environment {
  uid: string;
  title: string;
  description?: string;
  is_default?: boolean;
  [key: string]: unknown;
}

/**
 * Environment service interface.
 * Manages compute environments for notebooks.
 */
export interface IEnvironmentService extends ILifecycle {
  /**
   * List all available environments.
   */
  listEnvironments(): Promise<Environment[]>;

  /**
   * Get a specific environment by ID.
   */
  getEnvironment(environmentId: string): Promise<Environment | null>;

  /**
   * Get the default environment.
   */
  getDefaultEnvironment(): Promise<Environment | null>;

  /**
   * Refresh environments list from API.
   * Returns the refreshed list of environments.
   */
  refreshEnvironments(): Promise<Environment[]>;
}
