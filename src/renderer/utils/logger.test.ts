/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the logger utility.
 *
 * @module renderer/utils/logger.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-log before importing logger
vi.mock('electron-log/renderer', () => {
  const createLogger = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    scope: vi.fn((name: string) => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    transports: {
      console: {
        level: 'debug',
      },
    },
  });

  return {
    default: createLogger(),
  };
});

describe('logger utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (global.window as any)?.logger;
  });

  it('should export a default logger', async () => {
    const { logger } = await import('./logger');
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should export module-specific loggers', async () => {
    const {
      apiLogger,
      proxyLogger,
      runtimeLogger,
      notebookLogger,
      collaborationLogger,
    } = await import('./logger');

    expect(apiLogger).toBeDefined();
    expect(proxyLogger).toBeDefined();
    expect(runtimeLogger).toBeDefined();
    expect(notebookLogger).toBeDefined();
    expect(collaborationLogger).toBeDefined();
  });

  it('should create scoped loggers', async () => {
    const { logger } = await import('./logger');
    expect(logger.scope).toBeDefined();
    expect(typeof logger.scope).toBe('function');
  });

  it('should configure console transport based on environment', async () => {
    const { logger } = await import('./logger');
    expect(logger.transports.console).toBeDefined();
    expect(logger.transports.console.level).toBeDefined();
  });

  it('should allow custom scoping', async () => {
    const { logger } = await import('./logger');
    const customLogger = logger.scope('custom');
    expect(customLogger).toBeDefined();
    expect(typeof customLogger.debug).toBe('function');
  });
});
