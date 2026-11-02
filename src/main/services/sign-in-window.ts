/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The provider sign-in's window (DESKTOP DK-03): a small `BrowserWindow`
 * over the main window, in a partition of its own that is never kept
 * (`sign-in`, in memory, cleared when the window closes), showing IAM's
 * provider page and what that page navigates to on the web. The callback
 * IAM sends the browser to (`datalayer://auth?…`) is caught here — on
 * `will-navigate`, `will-redirect` or a `window.open` — handed to the
 * sign-in, and the window closed. No protocol is registered with the OS,
 * so it works the same in a Linux development run as installed.
 *
 * A window closed by the person before the callback is said so
 * (`onClosed`); a link to another page that opens a window goes to the OS
 * browser; nothing else (a `file:` URL, another scheme) is followed.
 *
 * `signInNavigationAnswer` is pure; the wiring below it is the only part
 * that touches Electron.
 *
 * @module main/services/sign-in-window
 */

import { BrowserWindow, session, shell } from 'electron';
import log from 'electron-log/main';
import { isSignInCallback } from './sign-in';

/** The sign-in window's partition: in memory, never kept. */
export const SIGN_IN_PARTITION = 'sign-in';

/** The window's size. */
export const SIGN_IN_WINDOW_SIZE = { width: 520, height: 720 } as const;

/** What the window does with a navigation. */
export type SignInNavigationAnswer = 'sign-in-callback' | 'allow' | 'refuse';

/**
 * The navigation policy: the callback caught, the web followed (IAM's
 * page and the provider's), anything else refused.
 *
 * @param url - Where the page wants to go.
 *
 * @returns The answer.
 */
export function signInNavigationAnswer(url: string): SignInNavigationAnswer {
  if (isSignInCallback(url)) {
    return 'sign-in-callback';
  }
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? 'allow' : 'refuse';
  } catch {
    return 'refuse';
  }
}

/** What the window tells the sign-in. */
export interface SignInWindowHandlers {
  /** The callback was caught: the window closes after. */
  onCallback: (url: string) => void;
  /** The person closed the window before the callback. */
  onClosed: () => void;
}

let window: BrowserWindow | null = null;

/** Windows closed by the app (a new sign-in, a sign-out), not by the person. */
const closedByTheApp = new WeakSet<BrowserWindow>();

/**
 * Opens IAM's page in the sign-in window, replacing one already open.
 *
 * @param url - The authorization URL.
 * @param parent - The main window, which the sign-in window sits over.
 * @param handlers - Where the callback and a close go.
 *
 * @returns The window.
 */
export function openSignInWindow(
  url: string,
  parent: BrowserWindow | null,
  handlers: SignInWindowHandlers
): BrowserWindow {
  closeSignInWindow();
  let caught = false;
  const opened = new BrowserWindow({
    ...SIGN_IN_WINDOW_SIZE,
    ...(parent && !parent.isDestroyed() ? { parent, modal: true } : {}),
    title: 'Sign in to Datalayer',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      partition: SIGN_IN_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window = opened;
  const contents = opened.webContents;
  const catchCallback = (callback: string) => {
    if (caught) {
      return;
    }
    caught = true;
    handlers.onCallback(callback);
    if (!opened.isDestroyed()) {
      opened.close();
    }
  };
  const navigate = (event: { preventDefault: () => void }, to: string) => {
    const answer = signInNavigationAnswer(to);
    if (answer === 'allow') {
      return;
    }
    event.preventDefault();
    if (answer === 'sign-in-callback') {
      catchCallback(to);
    } else {
      log.info(`[Sign-in] A navigation the sign-in does not follow: ${to}`);
    }
  };
  contents.on('will-navigate', navigate);
  contents.on('will-redirect', navigate);
  contents.setWindowOpenHandler(({ url: asked }) => {
    const answer = signInNavigationAnswer(asked);
    if (answer === 'sign-in-callback') {
      catchCallback(asked);
    } else if (answer === 'allow') {
      void shell.openExternal(asked);
    }
    return { action: 'deny' };
  });
  opened.on('closed', () => {
    if (window === opened) {
      window = null;
    }
    session
      .fromPartition(SIGN_IN_PARTITION)
      .clearStorageData()
      .catch(() => undefined);
    if (!caught && !closedByTheApp.has(opened)) {
      handlers.onClosed();
    }
  });
  void contents.loadURL(url);
  return opened;
}

/** Closes the sign-in window, if one is open (sign-out, a new sign-in): not said as the person's close. */
export function closeSignInWindow(): void {
  const open = window;
  window = null;
  if (open && !open.isDestroyed()) {
    closedByTheApp.add(open);
    open.close();
  }
}

/** The sign-in window's URL, for the suite and the log; empty when none is open. */
export function signInWindowUrl(): string {
  return window && !window.isDestroyed() ? window.webContents.getURL() : '';
}
