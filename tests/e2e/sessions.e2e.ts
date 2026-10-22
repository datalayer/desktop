/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The sessions (DESKTOP DK-07, DK-09, DK-13, DK-15): signed in, with the
 * stub `loop` on `PATH` and a folder remembered, the app starts that
 * folder's runtime at launch, the Sessions page lists this machine's
 * sessions from the stub's file store with their state and folder, a row
 * opens its conversation in the chat, an approval the stub raises is
 * answered from the chat's banner and reaches the runtime (DK-13), and the
 * session in front is exported to a file, imported back and reopened from
 * the list (DK-10, DK-09).
 *
 * The later journeys (work in a folder with the fake harness, the app
 * reopened and the session resumed) join this file on the same fixture.
 */

import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, signInWithToken, tab, type LaunchedApp } from './app';

/** The stub's answers the journeys read. */
type Row = Record<string, unknown>;

/**
 * The URL of the local runtime the app runs for the folder, as the renderer
 * reads it.
 */
async function runtimeUrl(launched: LaunchedApp): Promise<string> {
  const runtimes = await launched.window.evaluate(() =>
    (
      window as unknown as {
        desktopAPI: { localRuntime: { list: () => Promise<Row[]> } };
      }
    ).desktopAPI.localRuntime.list()
  );
  const url = runtimes[0]?.url;
  expect(typeof url).toBe('string');
  return String(url);
}

/**
 * Opens the stub's first session in the chat, from its row: each journey
 * stands on its own (a failed one restarts the app).
 */
async function openFirstSession(launched: LaunchedApp): Promise<void> {
  const { window } = launched;
  await tab(window, 'Sessions').click();
  const row = window
    .getByTestId('sessions')
    .locator('[data-session-row="stub00000001"]');
  await expect(row).toBeVisible({ timeout: 90_000 });
  await row.click();
  await expect(window.getByText('The stub answers.').first()).toBeVisible({
    timeout: 60_000,
  });
}

/** Clicks a menu's entry in the main process, as a person would. */
async function clickMenu(
  launched: LaunchedApp,
  menu: string,
  entry: string
): Promise<void> {
  await expect
    .poll(async () =>
      launched.app.evaluate(
        ({ Menu }, [menuLabel, entryLabel]) => {
          const item = Menu.getApplicationMenu()
            ?.items.find(top => top.label === menuLabel)
            ?.submenu?.items.find(one => one.label === entryLabel);
          if (!item) {
            return false;
          }
          item.click();
          return true;
        },
        [menu, entry]
      )
    )
    .toBe(true);
}

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

// Nothing the renderer throws passes unseen: a page that crashes on mount
// (Primer refusing a group heading, say) blanks the window without failing
// a test that waits for text elsewhere.
test.afterEach(() => {
  expect(launched.pageErrors).toEqual([]);
});

test.afterAll(async () => {
  await launched.close();
});

test('the Sessions page lists this machine’s sessions, and a row opens in the chat', async () => {
  const { window } = launched;
  await tab(window, 'Sessions').click();
  const page = window.getByTestId('sessions');
  await expect(page).toBeVisible({ timeout: 30_000 });
  // The stub's planted sessions, listed from the last folder's runtime —
  // each a row of the list (the home pane names recent ones too).
  const first = page.locator('[data-session-row="stub00000001"]');
  await expect(first).toBeVisible({ timeout: 90_000 });
  await expect(first).toContainText('Rename the helpers');
  await expect(page.locator('[data-session-row="stub00000002"]')).toContainText(
    'Add the changelog'
  );
  await expect(page.getByText(/on this machine/).first()).toBeVisible();
  // The page drew its groups — a place and its application, as headings.
  await expect(
    page.getByRole('heading', { name: /On this machine/ }).first()
  ).toBeVisible();
  await first.click();
  // The conversation: the stub's two messages drawn by the chat.
  await expect(window.getByText('The stub answers.').first()).toBeVisible({
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

test('an approval raised on this machine is answered from the chat’s banner, and the runtime is told', async () => {
  const { window } = launched;
  await openFirstSession(launched);
  const url = await runtimeUrl(launched);
  // The session in front is the stub's first; the stub raises its git push.
  const raised = await fetch(`${url}/stub/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: 'stub00000001' }),
  });
  expect(raised.status).toBe(201);
  const approval = (await raised.json()) as Row;

  // The main process's socket reads it; the chat in front shows it whole.
  await expect(
    window.getByText('Run git push').filter({ visible: true }).first()
  ).toBeVisible({
    timeout: 30_000,
  });
  // The banner's own Review (another page may hold a hidden one).
  await window
    .getByRole('button', { name: 'Review', exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await window
    .getByRole('button', { name: 'Deny', exact: true })
    .filter({ visible: true })
    .first()
    .click();

  // The decision went over the runtime's websocket, as the runtime took it.
  await expect
    .poll(
      async () =>
        (
          (await (await fetch(`${url}/stub/decisions`)).json()) as {
            decisions: Row[];
          }
        ).decisions,
      { timeout: 30_000 }
    )
    .toContainEqual({ approvalId: approval.id, approved: false });
  // The banner is gone; the page says what was decided, in the place's words.
  await expect(window.getByText(/tool approvals? pending/)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(window.getByTestId('sessions-said')).toContainText(
    'Declined: Run git push.'
  );
});

test('the session in front is exported to a file, imported back and reopened from the list', async () => {
  const { window } = launched;
  await openFirstSession(launched);
  const url = await runtimeUrl(launched);
  const file = join(
    mkdtempSync(join(tmpdir(), 'desktop-e2e-export-')),
    'exported.session.jsonl'
  );
  // The OS dialogs answer with the file: the save dialog, then the open one.
  await launched.app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: path,
    })) as unknown as typeof dialog.showSaveDialog;
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [path],
    })) as unknown as typeof dialog.showOpenDialog;
  }, file);

  await clickMenu(launched, 'Sessions', 'Export…');
  await expect.poll(() => existsSync(file), { timeout: 30_000 }).toBe(true);
  const [head] = readFileSync(file, 'utf8').split('\n');
  expect(JSON.parse(head)).toMatchObject({
    kind: 'session',
    uid: 'stub00000001',
    agent: 'default',
  });
  const exportedAt = String(JSON.parse(head).exported_at);

  await clickMenu(launched, 'File', 'Import a session…');
  // The runtime holds a new session, paused, imported from that file.
  const found: { row?: Row } = {};
  await expect
    .poll(
      async () => {
        const { sessions } = (await (
          await fetch(`${url}/api/v1/apps/sessions`)
        ).json()) as { sessions: Row[] };
        found.row = sessions.find(
          session =>
            (session.lineage as { imported_from?: Row | null })?.imported_from
              ?.exported_at === exportedAt
        );
        return found.row?.state;
      },
      { timeout: 30_000 }
    )
    .toBe('paused');

  // The list shows it, said imported; opened, its conversation is there.
  const row = window.locator(`[data-session-row="${String(found.row?.uid)}"]`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText(/imported/i);
  await row.click();
  await expect(window.getByText('Hello from the stub').first()).toBeVisible({
    timeout: 60_000,
  });
});
