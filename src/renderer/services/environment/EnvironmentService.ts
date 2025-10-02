/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module services/environment/EnvironmentService
 *
 * Environment service implementation using dependency injection.
 * Manages computing environments with caching and state management.
 */

import { DatalayerClient, EnvironmentJSON } from '@datalayer/core/lib/client';
import { BaseService } from '../core/BaseService';
import { ILogger } from '../interfaces/ILogger';
import {
  IEnvironmentService,
  Environment,
} from '../interfaces/IEnvironmentService';

/**
 * Environment service implementation with caching.
 */
export class EnvironmentService
  extends BaseService
  implements IEnvironmentService
{
  private environments: Environment[] = [];
  private lastFetchTime: number | null = null;
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  constructor(
    // @ts-ignore - Reserved for future SDK direct usage
    private readonly sdk: DatalayerClient,
    logger: ILogger
  ) {
    super('EnvironmentService', logger);
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('EnvironmentService initialized');
  }

  protected async onDispose(): Promise<void> {
    this.environments = [];
    this.lastFetchTime = null;
    this.logger.info('EnvironmentService disposed');
  }

  /**
   * List all available environments.
   * Uses cached data if available and valid.
   */
  async listEnvironments(): Promise<Environment[]> {
    this.assertReady();

    // Return cached data if valid
    if (this.isCacheValid() && this.environments.length > 0) {
      this.logger.debug('Using cached environments data');
      return this.environments;
    }

    // Fetch fresh data
    return this.refreshEnvironments();
  }

  /**
   * Get a specific environment by ID.
   */
  async getEnvironment(environmentId: string): Promise<Environment | null> {
    this.assertReady();

    const environments = await this.listEnvironments();
    return environments.find(env => env.uid === environmentId) || null;
  }

  /**
   * Get the default environment.
   */
  async getDefaultEnvironment(): Promise<Environment | null> {
    this.assertReady();

    const environments = await this.listEnvironments();
    return (
      environments.find(env => env.is_default === true) ||
      environments[0] ||
      null
    );
  }

  /**
   * Refresh environments list from API.
   * Forces a fresh fetch even if cache is valid.
   */
  async refreshEnvironments(): Promise<Environment[]> {
    this.assertReady();

    try {
      this.logger.debug('Fetching fresh environments data...');

      // Use SDK to list environments (via IPC bridge)
      const rawEnvironments = await window.datalayerClient.listEnvironments();

      if (!Array.isArray(rawEnvironments)) {
        throw new Error('Invalid environments response');
      }

      // Map to our Environment interface
      this.environments = rawEnvironments.map((env: EnvironmentJSON) => ({
        uid: env.name, // Use name as uid
        title: env.title,
        description: env.description,
        rich_description: env.richDescription,
        burning_rate: env.burningRate,
        name: env.name,
        is_default: false, // Not in EnvironmentJSON, set default
      }));

      this.lastFetchTime = Date.now();

      this.logger.debug(`Fetched ${this.environments.length} environments`);

      return this.environments;
    } catch (error) {
      this.logger.error('Failed to fetch environments', error as Error);
      throw error;
    }
  }

  /**
   * Check if cached data is still valid.
   */
  private isCacheValid(): boolean {
    if (!this.lastFetchTime) return false;

    const now = Date.now();
    const age = now - this.lastFetchTime;
    return age < this.cacheExpiryMs;
  }

  /**
   * Invalidate cache to force refresh on next fetch.
   */
  invalidateCache(): void {
    this.lastFetchTime = null;
    this.logger.debug('Environment cache invalidated');
  }

  /**
   * Set cache expiry time in milliseconds.
   */
  setCacheExpiry(ms: number): void {
    this.cacheExpiryMs = ms;
    this.logger.debug(`Cache expiry set to ${ms}ms`);
  }
}
