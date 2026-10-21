/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Studio, embedded (DESKTOP DK-02, decision D-1): the web app in one
 * `WebContentsView` per window, on the landing origin, in a partition of
 * its own (`persist:studio`), opened on the Studio's Home (`/studio`) and
 * kept while the *Studio* tab is away. Nothing of Build, Try, Validate,
 * Ship or Activity is rebuilt: the page does it all.
 *
 * The view answers the microphone for the landing origin and nothing else
 * (the page's voice and avatars come with it); a link to another origin
 * opens in the OS browser; a navigation off the landing origin is refused,
 * except the sign-in callback (`datalayer://auth`, DK-03), which the main
 * process catches here and hands to sign-in.
 *
 * The policies are pure functions (`studioOrigin`, `navigationAnswer`,
 * `windowOpenAnswer`, `permissionAnswer`, `studioPath`); the wiring below
 * them is the only part that touches Electron.
 *
 * @module main/services/studio-view
 */

import {
  BrowserWindow,
  Rectangle,
  WebContentsView,
  session,
  shell,
} from 'electron';
import log from 'electron-log/main';
import { isDevelopment } from '../app/environment';
import { SIGN_IN_CALLBACK } from './sign-in';

/** The partition the Studio view's cookies live in: IAM's cookie lands here. */
export const STUDIO_PARTITION = 'persist:studio';

/** The landing in production; the development server otherwise. */
export const LANDING_ORIGINS = {
  production: 'https://datalayer.ai',
  development: 'http://localhost:3063',
} as const;

/**
 * An HTTP(S) origin, or `""` for anything else (a path, credentials, a
 * scheme that is not the web's).
 *
 * @param url - A configured URL.
 *
 * @returns Its origin.
 */
export function webOrigin(url: string | undefined): string {
  try {
    const parsed = new URL(url || '');
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
}

/**
 * The origin the Studio view is on: `DATALAYER_LANDING_URL` when set to a
 * web origin, else the development server in development, else the landing.
 *
 * @param env - The environment (the process's by default).
 * @param development - Whether the app runs in development.
 *
 * @returns The origin, without a trailing slash.
 */
export function studioOrigin(
  env: NodeJS.ProcessEnv = process.env,
  development: boolean = isDevelopment()
): string {
  return (
    webOrigin(env.DATALAYER_LANDING_URL) ||
    (development ? LANDING_ORIGINS.development : LANDING_ORIGINS.production)
  );
}

/**
 * Whether a URL is on the Studio's origin.
 *
 * @param url - The URL asked for.
 * @param origin - The Studio's origin.
 *
 * @returns Whether it is.
 */
export function isStudioUrl(url: string, origin: string): boolean {
  return webOrigin(url) === origin;
}

/**
 * Whether a URL is the sign-in callback (`datalayer://auth…`).
 *
 * @param url - The URL asked for.
 *
 * @returns Whether it is.
 */
export function isSignInCallback(url: string): boolean {
  return url === SIGN_IN_CALLBACK || url.startsWith(`${SIGN_IN_CALLBACK}?`);
}

/** What the view does with a navigation. */
export type NavigationAnswer = 'allow' | 'sign-in-callback' | 'refuse';

/**
 * The navigation policy: the Studio's origin is followed, the sign-in
 * callback is caught, anything else is refused.
 *
 * @param url - Where the page wants to go.
 * @param origin - The Studio's origin.
 *
 * @returns The answer.
 */
export function navigationAnswer(
  url: string,
  origin: string
): NavigationAnswer {
  if (isSignInCallback(url)) {
    return 'sign-in-callback';
  }
  return isStudioUrl(url, origin) ? 'allow' : 'refuse';
}

/** What the view does with a `window.open`: never a window of its own. */
export interface WindowOpenAnswer {
  /** The sign-in callback, opened as a window by a page that does so. */
  signInCallback: boolean;
  /** The Studio's own page, shown in the view itself. */
  inView: boolean;
  /** Another origin's page, opened in the OS browser. */
  outside: boolean;
}

/**
 * The window-open policy.
 *
 * @param url - What the page wants to open.
 * @param origin - The Studio's origin.
 *
 * @returns The answer: exactly one of its three is true.
 */
export function windowOpenAnswer(
  url: string,
  origin: string
): WindowOpenAnswer {
  if (isSignInCallback(url)) {
    return { signInCallback: true, inView: false, outside: false };
  }
  if (isStudioUrl(url, origin)) {
    return { signInCallback: false, inView: true, outside: false };
  }
  const outside = ['https:', 'http:', 'mailto:'].includes(scheme(url));
  return { signInCallback: false, inView: false, outside };
}

function scheme(url: string): string {
  try {
    return new URL(url).protocol;
  } catch {
    return '';
  }
}

/**
 * The permission policy: the microphone (`media` asking for audio) for the
 * Studio's origin, nothing else for anyone.
 *
 * @param permission - What is asked (`media`, `notifications`, `geolocation`, …).
 * @param requestingUrl - The page asking.
 * @param origin - The Studio's origin.
 * @param mediaTypes - For `media`, what of it (`audio`, `video`).
 *
 * @returns Whether it is granted.
 */
export function permissionAnswer(
  permission: string,
  requestingUrl: string,
  origin: string,
  mediaTypes: readonly string[] = []
): boolean {
  if (permission !== 'media' || !isStudioUrl(requestingUrl, origin)) {
    return false;
  }
  return mediaTypes.length === 0 || mediaTypes.every(kind => kind === 'audio');
}

/**
 * Where the view goes: the Studio's Home, or an application's Activity
 * (*Open in the Studio*, DK-10).
 *
 * @param where - `home`, or `app-activity` with the application's uid.
 *
 * @returns The path on the landing origin.
 */
export function studioPath(
  where: { kind: 'home' } | { kind: 'app-activity'; uid: string }
): string {
  if (where.kind === 'app-activity') {
    return `/studio/apps/${encodeURIComponent(where.uid)}?tab=activity`;
  }
  return '/studio';
}

/**
 * A path the renderer asks the view to open, kept to the Studio: a path
 * on the landing origin, never a URL.
 *
 * @param path - What was asked.
 *
 * @returns The path, or null when it is not one.
 */
export function studioPathOf(path: unknown): string | null {
  return typeof path === 'string' && /^\/[^/\\]/.test(path) ? path : null;
}

// --- the wiring ------------------------------------------------------------

/** The view, one per window; the window is one (D-1). */
let view: WebContentsView | null = null;
let origin = '';
let onSignInCallback: (url: string) => void = () => undefined;

/**
 * Creates the Studio view in a window, hidden, loading the Studio's Home.
 *
 * @param window - The main window.
 * @param callback - Where the sign-in callback goes (DK-03).
 *
 * @returns The view.
 */
export function createStudioView(
  window: BrowserWindow,
  callback: (url: string) => void
): WebContentsView {
  origin = studioOrigin();
  onSignInCallback = callback;
  view = new WebContentsView({
    webPreferences: {
      partition: STUDIO_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.contentView.addChildView(view);
  view.setVisible(false);

  const contents = view.webContents;
  const navigate = (event: { preventDefault: () => void }, url: string) => {
    const answer = navigationAnswer(url, origin);
    if (answer === 'allow') {
      return;
    }
    event.preventDefault();
    if (answer === 'sign-in-callback') {
      onSignInCallback(url);
    } else {
      log.info(`[Studio] A navigation off ${origin} was refused: ${url}`);
    }
  };
  contents.on('will-navigate', navigate);
  contents.on('will-redirect', navigate);
  contents.setWindowOpenHandler(({ url }) => {
    const answer = windowOpenAnswer(url, origin);
    if (answer.signInCallback) {
      onSignInCallback(url);
    } else if (answer.inView) {
      contents.loadURL(url);
    } else if (answer.outside) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  session
    .fromPartition(STUDIO_PARTITION)
    .setPermissionRequestHandler((_contents, permission, grant, details) => {
      const asked = details as {
        requestingUrl?: string;
        mediaTypes?: readonly string[];
      };
      grant(
        permissionAnswer(
          permission,
          asked.requestingUrl || '',
          origin,
          asked.mediaTypes || []
        )
      );
    });
  window.on('closed', () => {
    view = null;
  });
  contents.loadURL(`${origin}${studioPath({ kind: 'home' })}`);
  return view;
}

/**
 * Shows the view at the given bounds (the *Studio* tab's content area, or
 * the whole window while signing in).
 *
 * @param bounds - Where, in the window's content coordinates.
 */
export function showStudioView(bounds: Rectangle): void {
  if (!view) {
    return;
  }
  view.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  });
  view.setVisible(true);
}

/** Hides the view; the page stays loaded. */
export function hideStudioView(): void {
  view?.setVisible(false);
}

/**
 * Sends the view to a path on the landing origin.
 *
 * @param path - A path, as `studioPath` gives it.
 */
export function openInStudio(path: string): void {
  const kept = studioPathOf(path);
  if (!view || !kept) {
    return;
  }
  view.webContents.loadURL(`${origin}${kept}`);
}

/**
 * Loads a URL in the view: the sign-in's authorization URL, on IAM.
 *
 * @param url - The URL.
 */
export function loadInStudioView(url: string): void {
  view?.webContents.loadURL(url);
}

/** The URL the view is on, for the suite and the log. */
export function studioViewUrl(): string {
  return view?.webContents.getURL() || '';
}

/** Whether the view is shown. */
export function studioViewShown(): boolean {
  return view?.getVisible() ?? false;
}

/** The Studio's origin, as created. */
export function studioViewOrigin(): string {
  return origin;
}

/**
 * Forgets the partition's cookies and storage (sign-out, DK-03) and sends
 * the view back to the Studio's Home, signed out.
 */
export async function clearStudioSession(): Promise<void> {
  await session.fromPartition(STUDIO_PARTITION).clearStorageData();
  view?.webContents.loadURL(`${origin}${studioPath({ kind: 'home' })}`);
}
