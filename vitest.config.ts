/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Vitest configuration for Datalayer Desktop application.
 * Supports testing of main process (Node.js) and renderer process (browser) code.
 *
 * @module vitest.config
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Global test configuration
    globals: true,
    environment: 'happy-dom', // Fast DOM environment for React components
    setupFiles: ['./tests/setup.ts', './src/renderer/test-setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'dist-electron/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/tests/**',
        '**/__tests__/**',
        '**/test-utils/**',
        'scripts/**',
        '*.config.ts',
        '*.config.js',
      ],
      // Coverage thresholds
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },

    // Test file patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'dist-electron'],

    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@main': resolve(__dirname, './src/main'),
      '@renderer': resolve(__dirname, './src/renderer'),
      '@preload': resolve(__dirname, './src/preload'),
      '@shared': resolve(__dirname, './src/shared'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
