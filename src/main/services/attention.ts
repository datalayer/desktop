/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The OS tells the person (DESKTOP DK-14, Omnigent's rule borrowed whole):
 * a desktop `Notification` when a session asks for a decision, asks a
 * question, finishes a turn, or its runtime goes away — for every session
 * **except the one in front** (the window focused and that session open in
 * the chat); the body names the application, the action and its class for
 * an approval, the first line of the answer for a finished turn — never
 * arguments, a mail body or a file's content (decision D-8); a click
 * focuses the window on that session (`attention:focus`). When the app is
 * frontmost the OS shows no banner: the dock icon bounces or the taskbar
 * flashes instead. The dock badge counts the sessions waiting for the
 * person (`setOverlayIcon` on Windows); the tray shows the count and lists
 * them with *Open*. A sound is opt-in, off by default (`"attentionSound":
 * true` in `settings.json`).
 *
 * The transitions that fire, the words per class and the exclusion of the
 * session in front are agent-runtimes' `portable/attention.ts` (DK-25);
 * this module holds the OS.
 *
 * @module main/services/attention
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from 'electron';
import log from 'electron-log/main';
import {
  type ApprovalRaised,
  approvalNotification,
  badgeCount,
  cueOf,
  finishedTurns,
  newlyRaised,
  type SessionAttention,
  trayMenuOf,
} from '@datalayer/agent-runtimes/lib/portable/attention';
import { DESKTOP_SETTINGS_FILE } from '../../shared/appChat';
import {
  type AttentionFocus,
  IPC,
  type PendingApproval,
} from '../../shared/types/ipc.types';
import { getMainWindow } from '../app/window-manager';

/** What the OS does, so the tests give a fake. */
export interface AttentionOs {
  /** Whether the app's window is focused. */
  frontmost: () => boolean;
  /** A banner; the click opens the session. */
  notify: (
    title: string,
    body: string,
    onClick: () => void,
    sound: boolean
  ) => void;
  /** The dock bounce or the taskbar flash. */
  cue: () => void;
  /** The dock badge, or the overlay icon on Windows; zero clears it. */
  badge: (count: number) => void;
  /** The tray's tooltip and menu; a click on an entry opens the session. */
  tray: (
    tooltip: string,
    entries: Array<{ key: string; label: string }>,
    open: (key: string) => void
  ) => void;
  /** Focuses the window on a session or an approval: `attention:focus` to the renderer. */
  focus: (target: AttentionFocus) => void;
  /** Whether the opt-in sound is on. */
  sound: () => boolean;
}

/** The service. */
export interface Attention {
  /** The sessions as last listed; the transitions since the previous reading notify. */
  sessions(rows: readonly SessionAttention[]): void;
  /** The approvals pending now; each new one notifies once. */
  approvals(pending: readonly PendingApproval[]): void;
  /** The session the chat shows now, or null: never notified. */
  front(uid: string | null): void;
  /** What is in front, for the tests. */
  inFront(): string | null;
}

/** The title of every banner. */
export const NOTIFICATION_TITLE = 'Datalayer';

/**
 * The service over the OS.
 *
 * @param os - What the OS does.
 *
 * @returns The service.
 */
export function createAttention(os: AttentionOs): Attention {
  let before: SessionAttention[] = [];
  let front: string | null = null;
  const seenApprovals = new Set<string>();
  let lastCount = -1;

  const withFront = (rows: readonly SessionAttention[]): SessionAttention[] =>
    rows.map(row => ({ ...row, inFront: row.key === front && os.frontmost() }));

  const say = (body: string, target: AttentionFocus): void => {
    if (cueOf(os.frontmost()) === 'cue') {
      os.cue();
      return;
    }
    os.notify(NOTIFICATION_TITLE, body, () => os.focus(target), os.sound());
  };

  const count = (rows: readonly SessionAttention[]): void => {
    const waiting = badgeCount(rows);
    if (waiting !== lastCount) {
      lastCount = waiting;
      os.badge(waiting);
    }
    const entries = trayMenuOf(rows);
    os.tray(entries[0]?.label ?? NOTIFICATION_TITLE, entries, key =>
      os.focus({ uid: key })
    );
  };

  return {
    sessions(rows) {
      const now = withFront(rows);
      for (const notice of finishedTurns(before, now)) {
        say(notice.said, { uid: notice.key });
      }
      before = now;
      count(now);
    },
    approvals(pending) {
      const raised = newlyRaised(seenApprovals, pending);
      for (const approval of raised) {
        seenApprovals.add(approval.id);
        // An approval names no session: with the app frontmost it is a cue,
        // and the chat's banner shows it whole; a banner otherwise.
        const said = approvalNotification(
          approval.app,
          approval as Pick<ApprovalRaised, 'toolName' | 'args'>
        );
        say(said.message, { approval });
      }
      // Forgotten ones are not notified again, but the set does not grow forever.
      const ids = new Set(pending.map(approval => approval.id));
      for (const id of [...seenApprovals]) {
        if (!ids.has(id)) {
          seenApprovals.delete(id);
        }
      }
    },
    front(uid) {
      front = uid;
    },
    inFront: () => front,
  };
}

let tray: Tray | null = null;

function settingSound(): boolean {
  try {
    const parsed = JSON.parse(
      readFileSync(join(app.getPath('userData'), DESKTOP_SETTINGS_FILE), 'utf8')
    ) as Record<string, unknown>;
    return parsed.attentionSound === true;
  } catch {
    return false;
  }
}

function focusWindow(target: AttentionFocus): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
  window.webContents.send(IPC.attentionFocus, target);
}

/** The OS as Electron gives it. */
export function electronOs(): AttentionOs {
  return {
    frontmost: () => BrowserWindow.getFocusedWindow() !== null,
    notify: (title, body, onClick, sound) => {
      if (!Notification.isSupported()) {
        log.info(`[Attention] ${body} (notifications are not supported here)`);
        return;
      }
      const notification = new Notification({ title, body, silent: !sound });
      notification.on('click', onClick);
      notification.show();
    },
    cue: () => {
      const window = getMainWindow();
      if (process.platform === 'darwin') {
        app.dock?.bounce('informational');
      } else if (window && !window.isDestroyed()) {
        window.flashFrame(true);
      }
    },
    badge: count => {
      if (process.platform === 'win32') {
        const window = getMainWindow();
        if (window && !window.isDestroyed()) {
          window.setOverlayIcon(
            count > 0 ? overlayIconOf(count) : null,
            count > 0 ? `${count} waiting for you` : ''
          );
        }
        return;
      }
      app.setBadgeCount(count);
    },
    tray: (tooltip, entries, open) => {
      if (!tray) {
        try {
          tray = new Tray(join(__dirname, '../../resources/icon.png'));
        } catch (error) {
          log.warn(
            `[Attention] No tray: ${error instanceof Error ? error.message : String(error)}`
          );
          return;
        }
      }
      tray.setToolTip(tooltip);
      tray.setContextMenu(
        Menu.buildFromTemplate(
          entries.map(entry =>
            entry.key
              ? { label: entry.label, click: () => open(entry.key) }
              : { label: entry.label, enabled: false }
          )
        )
      );
    },
    focus: focusWindow,
    sound: settingSound,
  };
}

/** A 16×16 overlay with the count, for Windows' taskbar. */
function overlayIconOf(count: number): Electron.NativeImage {
  const text = count > 9 ? '9+' : String(count);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">` +
    `<circle cx="8" cy="8" r="8" fill="#cf222e"/>` +
    `<text x="8" y="12" font-family="sans-serif" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">${text}</text>` +
    `</svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  );
}

/** The app's attention: Electron's notifications, dock, taskbar and tray. */
export const attention: Attention = createAttention(electronOs());
