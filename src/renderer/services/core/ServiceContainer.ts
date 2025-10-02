/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module services/core/ServiceContainer
 *
 * Service container for dependency injection.
 * Manages all services with proper initialization order and lifecycle.
 */

import { DatalayerClient } from '@datalayer/core/lib/client';
import { ILifecycle, ServiceState } from '../interfaces/ILifecycle';
import { ILogger, ILoggerManager } from '../interfaces/ILogger';
import { IAuthService } from '../interfaces/IAuthService';
import { IEnvironmentService } from '../interfaces/IEnvironmentService';
import { IRuntimeService } from '../interfaces/IRuntimeService';
import { LoggerManager } from './LoggerService';
import { RuntimeService } from '../runtime/RuntimeService';
import { AuthService } from '../auth/AuthService';
import { EnvironmentService } from '../environment/EnvironmentService';

/**
 * Service container interface defining all available services.
 */
export interface IServiceContainer extends ILifecycle {
  // Core services
  readonly sdk: DatalayerClient;
  readonly loggerManager: ILoggerManager;
  readonly logger: ILogger;

  // Domain services
  readonly authService: IAuthService;
  readonly environmentService: IEnvironmentService;
  readonly runtimeService: IRuntimeService;
}

/**
 * Default implementation of the service container.
 * Provides lazy initialization of services with proper dependency injection.
 *
 * @example
 * ```typescript
 * const container = new ServiceContainer(sdk);
 * await container.initialize();
 *
 * // Use services
 * await container.authService.login(runUrl, token);
 * const runtime = await container.runtimeService.createRuntime('notebook-1');
 * ```
 */
export class ServiceContainer implements IServiceContainer {
  // Lifecycle state
  private _state: ServiceState = ServiceState.Uninitialized;

  // Lazy-initialized services
  private _loggerManager?: ILoggerManager;
  private _logger?: ILogger;
  private _authService?: IAuthService;
  private _environmentService?: IEnvironmentService;
  private _runtimeService?: IRuntimeService;

  constructor(public readonly sdk: DatalayerClient) {}

  get state(): ServiceState {
    return this._state;
  }

  // Logging services

  get loggerManager(): ILoggerManager {
    if (!this._loggerManager) {
      this._loggerManager = LoggerManager.getInstance();
    }
    return this._loggerManager;
  }

  get logger(): ILogger {
    if (!this._logger) {
      this._logger = this.loggerManager.createLogger('ServiceContainer');
    }
    return this._logger;
  }

  // Domain services (to be implemented)

  get authService(): IAuthService {
    if (!this._authService) {
      this.logger.debug('Lazily initializing AuthService');
      this._authService = new AuthService(
        this.sdk,
        this.loggerManager.createLogger('Auth')
      );
    }
    return this._authService;
  }

  get environmentService(): IEnvironmentService {
    if (!this._environmentService) {
      this.logger.debug('Lazily initializing EnvironmentService');
      this._environmentService = new EnvironmentService(
        this.sdk,
        this.loggerManager.createLogger('Environment')
      );
    }
    return this._environmentService;
  }

  get runtimeService(): IRuntimeService {
    if (!this._runtimeService) {
      this.logger.debug('Lazily initializing RuntimeService');
      this._runtimeService = new RuntimeService(
        this.sdk,
        this.loggerManager.createLogger('Runtime')
      );
    }
    return this._runtimeService;
  }

  /**
   * Initializes core services needed during app startup.
   * Only initializes logging - other services are lazy.
   *
   * Performance: This method is optimized to initialize only what's needed
   * during app startup. Domain services are deferred until first use.
   */
  async initialize(): Promise<void> {
    try {
      this._state = ServiceState.Initializing;
      this.logger.info('Initializing service container...');

      // Initialize logging infrastructure
      // Triggers logger creation (unused variable is intentional)
      this.logger;

      // ✨ PERFORMANCE: Auth, Environment, Runtime services are NOT initialized here
      // They will be lazily created when first accessed
      // This reduces app startup time significantly

      this._state = ServiceState.Ready;
      this.logger.info('Service container initialized successfully', {
        initializedServices: ['LoggerManager', 'Logger'],
        deferredServices: [
          'AuthService',
          'EnvironmentService',
          'RuntimeService',
        ],
      });
    } catch (error) {
      this._state = ServiceState.Error;
      if (this._logger) {
        this.logger.error(
          'Failed to initialize service container',
          error as Error
        );
      }
      throw error;
    }
  }

  /**
   * Disposes all services in reverse initialization order.
   * Cleans up resources and prepares for app shutdown.
   */
  async dispose(): Promise<void> {
    try {
      this._state = ServiceState.Disposing;
      this.logger.info('Disposing service container...');

      // Dispose services in reverse order of initialization
      if (this._runtimeService) {
        await this._runtimeService.dispose();
      }
      if (this._environmentService) {
        await this._environmentService.dispose();
      }
      if (this._authService) {
        await this._authService.dispose();
      }

      this._state = ServiceState.Disposed;
      this.logger.info('Service container disposed');

      this.logger.info('Service container disposed successfully');
    } catch (error) {
      this.logger.error('Error disposing service container', error as Error);
    }
  }
}
