/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Vitest configuration for Datalayer Desktop (DESKTOP DK-15).
 *
 * One configuration, three projects (vitest 3.2's `test.projects`, which
 * replaces the workspace file): `main` for the main process's services and
 * the IPC contract (node, one process per file — they mock `electron` and
 * spawn the stub `loop`), `unit` for the pure modules and the renderer's
 * pages (happy-dom), and `integration` for the tests that cross services
 * (`*.integration.test`). `npm run test:unit` runs `main` and `unit`.
 * Nothing here starts Electron — that is the Playwright suite under
 * `tests/e2e/`.
 *
 * @module vitest.config
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const aliases = {
  '@': resolve(__dirname, './src'),
  '@main': resolve(__dirname, './src/main'),
  '@renderer': resolve(__dirname, './src/renderer'),
  '@preload': resolve(__dirname, './src/preload'),
  '@shared': resolve(__dirname, './src/shared'),
  '@tests': resolve(__dirname, './tests'),
};

/** The main process's tests: node, no DOM, the IPC contract, the stub loop. */
const MAIN_TESTS = [
  'src/main/**/__tests__/**/*.test.ts',
  'src/shared/__tests__/ipcTypes.test.ts',
  'tests/mocks/**/*.test.ts',
];

/** What the projects share: the DOM, the setup files, the aliases. */
const shared = {
  plugins: [react()],
  resolve: { alias: aliases },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts', './src/renderer/test-setup.ts'],
    exclude: ['node_modules', 'dist', 'dist-electron', 'tests/e2e/**'],
    // The Datalayer packages' `lib/` is written for a bundler (directory and
    // extensionless imports, which Node's ESM loader refuses): Vite
    // transforms them as the app's build does, instead of Node loading them.
    server: { deps: { inline: [/@datalayer\//] } },
  },
} as const;

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    testTimeout: 10000,
    hookTimeout: 10000,
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
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
    projects: [
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'main',
          environment: 'node',
          pool: 'forks',
          include: MAIN_TESTS,
          exclude: [
            ...shared.test.exclude,
            'src/**/*.integration.test.{ts,tsx}',
          ],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'unit',
          include: [
            'src/**/*.test.{ts,tsx}',
            'src/**/__tests__/**/*.test.{ts,tsx}',
          ],
          exclude: [
            ...shared.test.exclude,
            ...MAIN_TESTS,
            'src/**/*.integration.test.{ts,tsx}',
            'src/**/*.e2e.test.{ts,tsx}',
          ],
        },
      },
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'integration',
          include: ['src/**/*.integration.test.{ts,tsx}'],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
