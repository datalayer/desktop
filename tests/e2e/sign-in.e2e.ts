/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Sign-in with a stub IAM (DESKTOP DK-03, DK-15): with a provider in a
 * sign-in window of its own — IAM asked for the page with the
 * `datalayer://auth` callback, its page sent on to the callback, the token
 * kept, the app signed in, the window closed, the menu with its signed-in
 * entries; the typed token as the second way; sign-out; the token kept
 * across a relaunch.
 */

import { expect, test } from '@playwright/test';
import { startStubIam } from '../mocks/iam';
import {
  launchApp,
  loginHeading,
  menuLabels,
  signInWithToken,
  windowUrls,
  tab,
  type LaunchedApp,
} from './app';

test.describe.configure({ mode: 'serial' });

test('signs in with GitHub in a sign-in window, then signs out', async () => {
  const launched = await launchApp();
  const { window, app, iam } = launched;
  try {
    await expect(loginHeading(window)).toBeVisible({ timeout: 60_000 });
    await window.getByTestId('sign-in-github').click();

    await expect(tab(window, 'Spaces')).toBeVisible({ timeout: 60_000 });
    expect(iam.authzAsked).toHaveLength(1);
    expect(iam.authzAsked[0]).toMatchObject({
      provider: 'github',
      callbackUri: 'datalayer://auth',
    });
    expect(iam.authzAsked[0].nonce).toMatch(/^[0-9a-f]{64}$/);

    await expect.poll(async () => (await windowUrls(app)).urls.length).toBe(1);
    expect((await windowUrls(app)).childViews).toBe(0);

    const menu = await menuLabels(app);
    expect(menu.File).toEqual([
      'Work in a folder…',
      'New session on Datalayer…',
      'Import a session…',
      'Sign out',
      'Quit',
    ]);

    await window.getByRole('button', { name: /User menu for/ }).click();
    await window.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(loginHeading(window)).toBeVisible({ timeout: 30_000 });
    expect((await menuLabels(app)).File).toEqual([
      'Work in a folder…',
      'Import a session…',
      'Quit',
    ]);
  } finally {
    await launched.close();
  }
});

test('a provider sign-in that fails says why on the Login page', async () => {
  const launched = await launchApp();
  const { window, iam } = launched;
  try {
    await expect(loginHeading(window)).toBeVisible({ timeout: 60_000 });
    await iam.close();
    await window.getByTestId('sign-in-github').click();
    await expect(
      window.getByText(/Datalayer could not sign you in/)
    ).toBeVisible({ timeout: 30_000 });
    await expect(window.getByTestId('sign-in-github')).toBeEnabled();
  } finally {
    await launched.app.close().catch(() => undefined);
  }
});

test('the typed token is the second way, and the token is kept across a relaunch', async () => {
  // One stub IAM for both launches: a launch closes the IAM it started.
  const iam = await startStubIam();
  const first = await launchApp({ iam });
  const { userData } = first;
  await signInWithToken(first);
  await first.close(true);

  const second = await launchApp({ userData, iam });
  try {
    await expect(tab(second.window, 'Spaces')).toBeVisible({ timeout: 60_000 });
  } finally {
    await second.close();
    await iam.close();
  }
});
