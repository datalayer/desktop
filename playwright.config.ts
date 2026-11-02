/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Playwright configuration for the e2e suite of the Electron app (DESKTOP
 * DK-15): `tests/e2e/*.e2e.ts`, one worker (one Electron at a time), the
 * app launched from its build by `tests/e2e/app.ts` with the stub `loop`
 * and the stub IAM — `npm run build` first, then `npm run test:e2e`
 * (`xvfb-run -a npm run test:e2e` on a Linux box without a display).
 *
 * @module playwright.config
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { outputFolder: 'test-results/html', open: 'never' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results/playwright',
});
