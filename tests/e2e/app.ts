/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The e2e suite's app (DESKTOP DK-15): Datalayer Desktop launched by
 * Playwright from its build (`dist/`, `npm run build` first) with the stub
 * `loop` on `PATH`, the stub IAM and landing on loopback, a user data folder
 * of its own — nothing of it needs a Datalayer account, Python or a model.
 *
 * `launchApp` gives the Electron app, its window and the stubs;
 * `signInWithToken` is the typed way; `studioView` reads the embedded view
 * from the main process.
 *
 * @module tests/e2e/app
 */

import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { startStubIam, type StubIam } from '../mocks/iam';

/** The repository, where `package.json` names the built main process. */
export const APP_ROOT = resolve(__dirname, '../..');

/** Where the stub `loop` lives: prepended to `PATH`. */
export const STUB_BIN = resolve(APP_ROOT, 'tests/mocks');

/** A launched app with what it was launched against. */
export interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  iam: StubIam;
  /** The user data folder (the token is kept here). */
  userData: string;
  /** Quits the app and stops the stubs; `keepUserData` to relaunch on it. */
  close: (keepUserData?: boolean) => Promise<void>;
}

/** What a launch may reuse: a user data folder, a stub IAM. */
export interface LaunchOptions {
  userData?: string;
  iam?: StubIam;
  /** The folder the stub loop names as its sessions' workspace. */
  workspace?: string;
  /**
   * Folders remembered as worked in (`sessions-folders.json`, the first
   * being the last): the app starts the last one's runtime at launch, so
   * the stub `loop` serves its planted sessions from the start.
   */
  rememberedFolders?: string[];
}

/**
 * Launches the app from its build.
 *
 * @param options - A user data folder or stub IAM to reuse.
 *
 * @returns The app, its window and the stubs.
 */
export async function launchApp(
  options: LaunchOptions = {}
): Promise<LaunchedApp> {
  const iam = options.iam ?? (await startStubIam());
  const userData =
    options.userData ?? mkdtempSync(join(tmpdir(), 'desktop-e2e-'));
  // A shell that runs Electron as Node (`ELECTRON_RUN_AS_NODE`, set by
  // some editors and agents) must not reach the app.
  const inherited = { ...process.env };
  delete inherited.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [APP_ROOT, '--no-sandbox'],
    cwd: APP_ROOT,
    env: {
      ...inherited,
      PATH: `${STUB_BIN}${delimiter}${process.env.PATH || ''}`,
      DATALAYER_IAM_URL: iam.url,
      DATALAYER_LANDING_URL: iam.url,
      DATALAYER_DESKTOP_USER_DATA: userData,
      AGENT_RUNTIMES_WORKSPACE_ROOT: options.workspace || '',
      ELECTRON_DISABLE_SANDBOX: '1',
      ELECTRON_ENABLE_LOGGING: '0',
    },
    timeout: 60_000,
  });
  const window = await mainWindowOf(app, iam.url);
  // What the renderer and the main process say when something breaks, in
  // the run's log: a blank window says nothing by itself.
  window.on('pageerror', error =>
    console.log(`[renderer pageerror] ${error.stack || error.message}`)
  );
  window.on('console', message => {
    if (message.type() === 'error') {
      console.log(`[renderer console.error] ${message.text()}`);
    }
  });
  app.process().stderr?.on('data', chunk => {
    const text = String(chunk);
    if (/error/i.test(text)) {
      console.log(`[main stderr] ${text.trimEnd()}`);
    }
  });
  return {
    app,
    window,
    iam,
    userData,
    close: async (keepUserData = false) => {
      await app.close().catch(() => undefined);
      if (!options.iam) {
        await iam.close();
      }
      if (!keepUserData) {
        rmSync(userData, { recursive: true, force: true });
      }
    },
  };
}

/**
 * The main window's page: Playwright lists the Studio view's page (a
 * `WebContentsView` on the landing origin) and, in development, the
 * DevTools as windows too, so the main window is the page on the app's
 * own URL — `file://` from the build, `ELECTRON_RENDERER_URL` from the
 * development server.
 *
 * @param app - The app.
 * @param landing - The landing origin the Studio view is on (excluded).
 *
 * @returns The renderer's page.
 */
export async function mainWindowOf(
  app: ElectronApplication,
  landing: string
): Promise<Page> {
  const renderer = process.env.ELECTRON_RENDERER_URL || '';
  const isMain = (page: Page) => {
    const url = page.url();
    if (!url || url.startsWith(landing) || url.startsWith('devtools://')) {
      return false;
    }
    return (
      url.startsWith('file://') || (renderer !== '' && url.startsWith(renderer))
    );
  };
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const found = app.windows().find(isMain);
    if (found) {
      return found;
    }
    await Promise.race([
      app.waitForEvent('window', { timeout: 5_000 }).catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, 1_000)),
    ]);
  }
  throw new Error(
    `No main window in 60 s: ${app
      .windows()
      .map(page => page.url())
      .join(', ')}`
  );
}

/** The Login page's heading. */
export function loginHeading(window: Page) {
  return window.getByRole('heading', { name: 'Connect to Datalayer' });
}

/** A tab of the signed-in app's header. */
export function tab(window: Page, label: string) {
  return window.getByRole('link', { name: label, exact: true });
}

/**
 * Signs in the typed way: the stub IAM's URL and its token in the form.
 *
 * @param launched - The app.
 */
export async function signInWithToken(launched: LaunchedApp): Promise<void> {
  const { window, iam } = launched;
  await expect(loginHeading(window)).toBeVisible({ timeout: 60_000 });
  await window.getByRole('textbox', { name: /Run URL/ }).fill(iam.url);
  await window.getByRole('textbox', { name: /API Token/ }).fill(iam.token);
  await window.getByRole('button', { name: 'Connect' }).click();
  await expect(tab(window, 'Spaces')).toBeVisible({ timeout: 60_000 });
}

/** What the main process says of the Studio view. */
export interface StudioViewSeen {
  url: string;
  visible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  /** `own` when the view's session is not the window's. */
  partition: 'own' | 'default';
}

/**
 * Reads the Studio view from the main process: the one child view of the
 * main window.
 *
 * @param app - The app.
 *
 * @returns Its URL, visibility, bounds and partition.
 */
export async function studioView(
  app: ElectronApplication
): Promise<StudioViewSeen> {
  return app.evaluate(({ BrowserWindow, webContents }) => {
    const main = BrowserWindow.getAllWindows()[0];
    const view = main.contentView.children[0] as Electron.WebContentsView;
    // The view's contents, found by id: the child view's own reference can
    // be a bare View wrapper.
    const contents =
      webContents
        .getAllWebContents()
        .find(c => c.id === view.webContents?.id) || view.webContents;
    return {
      url: contents.getURL(),
      visible: view.getVisible(),
      bounds: view.getBounds(),
      partition:
        contents.session === main.webContents.session ? 'default' : 'own',
    };
  });
}

/**
 * The labels of the application menu, each top-level menu with its entries.
 *
 * @param app - The app.
 *
 * @returns `{ File: ['Work in a folder…', …], … }`.
 */
export async function menuLabels(
  app: ElectronApplication
): Promise<Record<string, string[]>> {
  return app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const labels: Record<string, string[]> = {};
    for (const item of menu?.items || []) {
      labels[item.label] = (item.submenu?.items || [])
        .map(entry => entry.label)
        .filter(Boolean);
    }
    return labels;
  });
}
