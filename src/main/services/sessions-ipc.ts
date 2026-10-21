/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The sessions' side of the main process, wired (DESKTOP §7's day-one
 * contract): the IPC handlers for `local-runtime:*`, `credentials:*`,
 * `sessions:*`, `approvals:*`, `dialog:*`, `shell:reveal` and
 * `attention:front`, each argument read through `ipc.types.ts`'s readers
 * (a wrong shape is refused in a sentence, never guessed); the events
 * `local-runtime:changed`, `sessions:changed`, `approvals:changed` and
 * `attention:focus` sent to the window; the runtime of the last folder
 * worked in started at launch (O-7); every runtime stopped when the app
 * quits. The `apps:*` channels are Apps' (`apps.ts`).
 *
 * @module main/services/sessions-ipc
 */

import { readFile, writeFile } from 'fs/promises';
import { basename } from 'path';
import { app, dialog, ipcMain, shell } from 'electron';
import log from 'electron-log/main';
import {
  IPC,
  readCredential,
  readCredentialName,
  readDecision,
  readFilter,
  readFolder,
  readFront,
  readOptionalFolder,
  readHarness,
  readOpenFile,
  readRevealPath,
  readSave,
} from '../../shared/types/ipc.types';
import { getMainWindow } from '../app/window-manager';
import { approvals } from './approvals';
import { attention } from './attention';
import { credentials } from './credentials';
import { localRuntimes } from './local-runtime';
import { sessionsSources } from './sessions-sources';

function send(channel: string, payload?: unknown): void {
  const window = getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, payload);
  }
}

/** Registers the handlers. Called once, after the SDK bridge is initialized. */
export function registerSessionsIpc(): void {
  ipcMain.handle(IPC.localRuntimeStart, async (_event, argument: unknown) => {
    const folder = readFolder(argument, IPC.localRuntimeStart);
    const runtime = await localRuntimes.ensureRunning(folder);
    const {
      folder: path,
      folderName,
      url,
      port,
      version,
      credentials: sources,
    } = runtime;
    return {
      folder: path,
      folderName,
      url,
      port,
      version,
      credentials: sources,
    };
  });
  ipcMain.handle(IPC.localRuntimeStop, async (_event, argument: unknown) => {
    await localRuntimes.stop(
      readOptionalFolder(argument, IPC.localRuntimeStop)
    );
  });
  ipcMain.handle(IPC.localRuntimeList, async () => localRuntimes.infos());
  ipcMain.handle(IPC.localRuntimeHarnesses, async (_event, argument: unknown) =>
    localRuntimes.harnesses(
      readOptionalFolder(argument, IPC.localRuntimeHarnesses)
    )
  );
  ipcMain.handle(
    IPC.localRuntimeCheckHarness,
    async (_event, argument: unknown) =>
      localRuntimes.checkHarness(
        readHarness(argument),
        readOptionalFolder(argument, IPC.localRuntimeCheckHarness)
      )
  );
  ipcMain.handle(IPC.localRuntimeFolders, async () => localRuntimes.folders());

  ipcMain.handle(IPC.credentialsSet, async (_event, argument: unknown) => {
    const { name, value } = readCredential(argument);
    credentials.set(name, value);
  });
  ipcMain.handle(IPC.credentialsHas, async (_event, argument: unknown) =>
    credentials.has(readCredentialName(argument))
  );

  ipcMain.handle(IPC.sessionsList, async (_event, argument: unknown) => {
    const listed = await sessionsSources.list(readFilter(argument));
    attention.sessions(sessionsSources.lastRows());
    return listed;
  });

  ipcMain.handle(IPC.approvalsPending, async () => approvals.pending());
  ipcMain.handle(IPC.approvalsDecide, async (_event, argument: unknown) =>
    approvals.decide(readDecision(argument))
  );

  ipcMain.handle(IPC.dialogOpenFolder, async () => {
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Work in a folder',
      buttonLabel: 'Work here',
    };
    const window = getMainWindow();
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    const [folder] = picked.filePaths;
    if (picked.canceled || !folder) {
      return null;
    }
    localRuntimes.remember(folder);
    return { folder, folderName: basename(folder) || folder };
  });
  ipcMain.handle(IPC.dialogSave, async (_event, argument: unknown) => {
    const { name, text } = readSave(argument);
    const window = getMainWindow();
    const picked = window
      ? await dialog.showSaveDialog(window, { defaultPath: name })
      : await dialog.showSaveDialog({ defaultPath: name });
    if (picked.canceled || !picked.filePath) {
      return null;
    }
    await writeFile(picked.filePath, text, 'utf8');
    return { path: picked.filePath };
  });
  ipcMain.handle(IPC.dialogOpenFile, async (_event, argument: unknown) => {
    const { accept } = readOpenFile(argument);
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: accept.join(', '), extensions: accept }],
    };
    const window = getMainWindow();
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    const [path] = picked.filePaths;
    if (picked.canceled || !path) {
      return null;
    }
    return { name: basename(path), path, text: await readFile(path, 'utf8') };
  });
  ipcMain.handle(IPC.shellReveal, async (_event, argument: unknown) => {
    shell.showItemInFolder(readRevealPath(argument));
  });

  ipcMain.handle(IPC.attentionFront, async (_event, argument: unknown) => {
    attention.front(readFront(argument));
  });
}

/**
 * Starts what runs beside the window: the sockets and the poll of the
 * approvals, the events to the renderer, the last folder's runtime (O-7),
 * and the stop at quit.
 */
export async function startSessionsServices(): Promise<void> {
  localRuntimes.onChange(() => {
    send(IPC.localRuntimeChanged);
    send(IPC.sessionsChanged);
  });
  approvals.onChange(pending => {
    attention.approvals(pending);
    send(IPC.approvalsChanged, pending);
    send(IPC.sessionsChanged);
  });
  approvals.start();
  app.on('will-quit', event => {
    if (localRuntimes.list().length === 0) {
      return;
    }
    event.preventDefault();
    approvals.stop();
    void localRuntimes.stop().finally(() => app.quit());
  });
  const started = await localRuntimes.startLastFolder();
  if (started) {
    log.info(
      `[Sessions] The last folder's runtime is at ${started.url} (${started.folder}).`
    );
  }
}
