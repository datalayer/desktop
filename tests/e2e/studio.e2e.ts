/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Studio, native (DESKTOP DK-02): signed in, the Studio tab is the
 * app's own page — no web page embedded — listing the person's
 * applications from Spacer (the stub's), each with what its deployments
 * say; one picked shows its Appspec on Build, says on Try why it cannot be
 * talked to here, lists its sessions with their lineage on Activity, and
 * pauses its deployment for the version it runs on Deployments; the View
 * menu's entry shows the tab too.
 */

import { expect, test } from '@playwright/test';
import {
  launchApp,
  signInWithToken,
  tab,
  windowUrls,
  type LaunchedApp,
} from './app';

let launched: LaunchedApp;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  launched = await launchApp({ studioServices: true });
  await signInWithToken(launched);
});

test.afterAll(async () => {
  await launched.close();
});

test('the Studio tab lists the applications, natively', async () => {
  const { window, app } = launched;
  await tab(window, 'Studio').click();
  const page = window.getByTestId('studio-page');
  await expect(
    page.getByRole('heading', { name: 'Your applications' })
  ).toBeVisible({ timeout: 30_000 });
  const row = page.locator('[data-app-row="app-1"]');
  await expect(row).toContainText('Desk');
  await expect(row).toContainText('Live · version 3');
  expect((await windowUrls(app)).childViews).toBe(0);
});

test('an application’s Build shows its Appspec, read-only, with the web Studio a click away', async () => {
  const { window, iam } = launched;
  const page = window.getByTestId('studio-page');
  await page.locator('[data-app-row="app-1"]').click();
  const build = page.getByTestId('studio-build');
  await expect(build).toContainText('accountant', { timeout: 30_000 });
  await expect(build.locator('pre')).toContainText('name: Desk');
  await expect(build.locator('[data-web-url]')).toHaveAttribute(
    'data-web-url',
    `${iam.url}/studio/apps/app-1?tab=build`
  );
});

test('Try says why the application cannot be talked to here', async () => {
  const page = launched.window.getByTestId('studio-page');
  await page.getByRole('button', { name: 'Try' }).click();
  const tried = page.getByTestId('studio-try');
  await expect(tried).toContainText(
    'None of this application’s deployments can be talked to here.',
    { timeout: 30_000 }
  );
  await expect(tried).toContainText('is not kept always on');
});

test('Activity lists its sessions with their lineage', async () => {
  const page = launched.window.getByTestId('studio-page');
  await page.getByRole('button', { name: 'Activity' }).click();
  const row = page.locator('[data-activity-row="ses-2"]');
  await expect(row).toContainText('Close the books', { timeout: 30_000 });
  await expect(row).toContainText('Cloned from ses-1 at turn 2');
});

test('Deployments pauses the deployment for the version it runs', async () => {
  const { window, iam } = launched;
  const page = window.getByTestId('studio-page');
  await page.getByRole('button', { name: 'Deployments' }).click();
  const row = page.locator('[data-deployment-row="dep-1"]');
  await expect(row).toContainText('Live · version 3', { timeout: 30_000 });
  await row.getByRole('button', { name: 'Pause' }).click();
  await expect(page).toContainText('Desk is paused (version 3).');
  await expect(row.getByRole('button', { name: 'Resume' })).toBeVisible();
  expect(iam.stateChanges).toEqual([
    { uid: 'dep-1', version: 3, state: 'paused' },
  ]);
});

test('View → Studio shows it as the tab does, and nothing broke', async () => {
  const { app, window, pageErrors } = launched;
  await tab(window, 'Spaces').click();
  await expect(window.getByTestId('studio-page')).toBeHidden();
  await app.evaluate(({ Menu }) => {
    const view = Menu.getApplicationMenu()?.items.find(
      item => item.label === 'View'
    );
    view?.submenu?.items.find(item => item.label === 'Studio')?.click();
  });
  await expect(window.getByTestId('studio-page')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
