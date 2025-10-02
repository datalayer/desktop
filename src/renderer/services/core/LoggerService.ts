/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module services/core/LoggerService
 *
 * Logger service implementation.
 * Provides structured logging with console output.
 */

import { ILogger, ILoggerManager } from '../interfaces/ILogger';

/**
 * Logger implementation with console output.
 */
export class Logger implements ILogger {
  constructor(private readonly name: string) {}

  info(message: string, context?: Record<string, unknown>): void {
    console.log(`[${this.name}] ${message}`, context || '');
  }

  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[${this.name}] ${message}`, context || '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[${this.name}] ${message}`, context || '');
  }

  error(
    message: string,
    error: Error,
    context?: Record<string, unknown>
  ): void {
    console.error(`[${this.name}] ${message}`, error, context || '');
  }
}

/**
 * Logger manager for creating loggers with consistent naming.
 */
export class LoggerManager implements ILoggerManager {
  private static instance: LoggerManager;

  private constructor() {}

  /**
   * Get singleton instance.
   * Note: This will be refactored to use dependency injection once ServiceContainer is in place.
   */
  static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }

  createLogger(name: string): ILogger {
    return new Logger(name);
  }
}
