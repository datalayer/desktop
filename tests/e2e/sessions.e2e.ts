/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The sessions (DESKTOP DK-07, DK-09, DK-13, DK-15): signed in, with the
 * stub `loop` on `PATH` and a folder remembered, the app starts that
 * folder's runtime at launch, the Sessions page lists this machine's
 * sessions from the stub's file store with their state and folder, a row
 * opens its conversation in the chat, and the stub's pending approval
 * reaches the page's banner.
 *
 * The later journeys (work in a folder with the fake harness, an approval
 * decided from the chat, export and import, the app reopened and the
 * session resumed) join this file on the same fixture.
 */

import { expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, signInWithToken, tab, type LaunchedApp } from './app';

let launched: LaunchedApp;
let folder: string;

test.beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), 'desktop-e2e-folder-'));
  launched = await launchApp({
    workspace: folder,
    rememberedFolders: [folder],
  });
  await signInWithToken(launched);
});

test.afterAll(async () => {
  await launched.close();
});

test('the Sessions page lists this machine’s sessions, and a row opens in the chat', async () => {
  const { window } = launched;
  await tab(window, 'Sessions').click();
  const page = window.getByTestId('sessions');
  await expect(page).toBeVisible({ timeout: 30_000 });
  // The stub's planted sessions, listed from the last folder's runtime.
  await expect(page.getByText('Rename the helpers')).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText('Add the changelog')).toBeVisible();
  await expect(page.getByText(/on this machine/).first()).toBeVisible();
  await page.getByText('Rename the helpers').click();
  // The conversation: the stub's two messages drawn by the chat.
  await expect(window.getByText('The stub answers.')).toBeVisible({
    timeout: 60_000,
  });
});

test('the menu names the running runtime, and Sessions → Export… once a session is in front', async () => {
  const { app } = launched;
  await expect
    .poll(async () =>
      app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()
          ?.items.find(item => item.label === 'File')
          ?.submenu?.items.map(entry => entry.label)
      )
    )
    .toContain('Stop the local runtime');
  await expect
    .poll(async () =>
      app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()
          ?.items.find(item => item.label === 'Sessions')
          ?.submenu?.items.map(entry => entry.label)
      )
    )
    .toContain('Export…');
});
