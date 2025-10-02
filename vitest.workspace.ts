/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Vitest workspace configuration for multi-project testing.
 * Separates unit tests from integration tests for better organization.
 *
 * @module vitest.workspace
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Unit tests - fast, isolated tests
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['src/**/*.integration.test.{ts,tsx}', 'src/**/*.e2e.test.{ts,tsx}'],
      environment: 'happy-dom',
    },
  },

  // Integration tests - tests that involve multiple components/services
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['src/**/*.integration.test.{ts,tsx}'],
      environment: 'happy-dom',
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  },
]);
