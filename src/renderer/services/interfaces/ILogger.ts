/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Logger interface for structured logging.
 */
export interface ILogger {
  /**
   * Log informational message.
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Log debug message.
   */
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * Log warning message.
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Log error with stack trace.
   */
  error(message: string, error: Error, context?: Record<string, unknown>): void;
}

/**
 * Logger manager interface for creating scoped loggers.
 */
export interface ILoggerManager {
  /**
   * Create a logger with a specific scope/name.
   */
  createLogger(name: string): ILogger;
}
