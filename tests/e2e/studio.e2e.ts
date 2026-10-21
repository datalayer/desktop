/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Studio, embedded (DESKTOP DK-02): signed in, the Studio tab shows
 * the main process's view over the tab's content area, on the landing's
 * `/studio`; another tab hides it and its page stays; the View menu's
 * entry shows it too.
 */

import { expect, test } from '@playwright/test';
import {
  launchApp,
  signInWithToken,
  studioView,
  tab,
  type LaunchedApp,
} from './app';

let launched: LaunchedApp;

test.beforeAll(async () => {
  launched = await launchApp();
  await signInWithToken(launched);
});

test.afterAll(async () => {
  await launched.close();
});

test('the Studio tab shows the view over its content area, another tab hides it', async () => {
  const { window, app, iam } = launched;
  await tab(window, 'Studio').click();
  await expect.poll(async () => (await studioView(app)).visible).toBe(true);
  const shown = await studioView(app);
  expect(shown.url).toBe(`${iam.url}/studio`);
  const windowSize = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getContentSize()
  );
  expect(shown.bounds.y).toBeGreaterThan(20);
  expect(shown.bounds.width).toBeGreaterThan(windowSize[0] * 0.9);
  expect(shown.bounds.height).toBeGreaterThan(windowSize[1] * 0.5);
  expect(shown.bounds.y + shown.bounds.height).toBeLessThanOrEqual(
    windowSize[1] + 1
  );

  await tab(window, 'Spaces').click();
  await expect.poll(async () => (await studioView(app)).visible).toBe(false);
  expect((await studioView(app)).url).toBe(`${iam.url}/studio`);
});

test('View → Studio shows it as the tab does', async () => {
  const { app } = launched;
  await app.evaluate(({ Menu }) => {
    const view = Menu.getApplicationMenu()?.items.find(
      item => item.label === 'View'
    );
    view?.submenu?.items.find(item => item.label === 'Studio')?.click();
  });
  await expect.poll(async () => (await studioView(app)).visible).toBe(true);
});
