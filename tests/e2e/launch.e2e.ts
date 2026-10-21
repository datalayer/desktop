/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The app launches (DESKTOP DK-15): the window opens on the Login page
 * with the two ways to sign in, the Studio view is created hidden on the
 * landing origin, the menu says what the app can do while signed out, and
 * no renderer can ask for the token.
 */

import { expect, test } from '@playwright/test';
import {
  launchApp,
  loginHeading,
  menuLabels,
  studioView,
  type LaunchedApp,
} from './app';

let launched: LaunchedApp;

test.beforeAll(async () => {
  launched = await launchApp();
});

test.afterAll(async () => {
  await launched.close();
});

test('opens on the Login page with a provider sign-in, a handle and password, and the token under More options', async () => {
  const { window } = launched;
  await expect(loginHeading(window)).toBeVisible({ timeout: 60_000 });
  await expect(window.getByTestId('sign-in-github')).toBeVisible();
  await expect(window.getByTestId('sign-in-google')).toBeVisible();
  await expect(window.getByRole('textbox', { name: /Handle/ })).toBeVisible();
  await expect(window.getByRole('textbox', { name: /API Token/ })).toHaveCount(
    0
  );
  await window.getByRole('button', { name: 'More options' }).click();
  await window
    .getByRole('button', { name: 'Sign in with an API token instead' })
    .click();
  await expect(
    window.getByRole('textbox', { name: /API Token/ })
  ).toBeVisible();
  await expect(window).toHaveTitle(/Datalayer/);
});

test('created the Studio view hidden, in its own partition, on the landing’s Home', async () => {
  const view = await studioView(launched.app);
  expect(view.visible).toBe(false);
  expect(view.partition).toBe('own');
  expect(view.url).toBe(`${launched.iam.url}/studio`);
  expect(launched.iam.landingPaths).toContain('/studio');
});

test('the menu, signed out: no session on Datalayer, no sign-out, no stop', async () => {
  const menu = await menuLabels(launched.app);
  expect(Object.keys(menu)).toEqual([
    'File',
    'Edit',
    'Sessions',
    'View',
    'Help',
  ]);
  expect(menu.File).toEqual(['Work in a folder…', 'Import a session…', 'Quit']);
  expect(menu.Sessions).toEqual(['Resume last']);
  expect(menu.View.slice(0, 5)).toEqual([
    'Sessions',
    'Studio',
    'Spaces',
    'Agents',
    'Environments',
  ]);
  expect(menu.Help).toEqual([
    'Datalayer docs',
    'Report a problem',
    'GitHub',
    'About Datalayer Desktop',
  ]);
});

test('no renderer can ask for the token', async () => {
  const exposed = await launched.window.evaluate(() => {
    const client =
      (window as unknown as { datalayerClient?: Record<string, unknown> })
        .datalayerClient || {};
    return {
      login: typeof client.login,
      credentials: Object.keys(client).filter(name => /credential/i.test(name)),
    };
  });
  expect(exposed).toEqual({ login: 'function', credentials: [] });
});
