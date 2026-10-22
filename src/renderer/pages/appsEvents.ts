/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * How another part of the app asks Apps to open an application on a
 * section (*Open in Apps*, DESKTOP DK-02) and the Sessions page to
 * open a session (a row of Apps' Activity). Light on purpose: the
 * app shell and the session entries import it without Apps' page.
 *
 * @module renderer/pages/appsEvents
 */

/** The sections of an application, in their order. */
export const APPS_SECTIONS = [
  'build',
  'try',
  'activity',
  'deployments',
] as const;

/** One of them. */
export type AppsSection = (typeof APPS_SECTIONS)[number];

/** The event that brings the Apps tab to the front on an application. */
export const OPEN_APPS_EVENT = 'datalayer:open-apps';

/** The event that brings the Sessions tab to the front on a session. */
export const OPEN_SESSION_EVENT = 'datalayer:open-session';

/** What *Open in Apps* asks. */
export interface AppsOpenRequest {
  appUid: string;
  section: AppsSection;
}

let pending: AppsOpenRequest | null = null;

/**
 * Asks Apps to open an application on a section: kept until the page
 * takes it (it may not be mounted yet), and said to the app and the page.
 *
 * @param request - The application and the section.
 */
export function requestAppsOpen(request: AppsOpenRequest): void {
  pending = request;
  window.dispatchEvent(
    new CustomEvent<AppsOpenRequest>(OPEN_APPS_EVENT, { detail: request })
  );
}

/**
 * The request not yet taken, taken.
 *
 * @returns It, or null.
 */
export function takeAppsOpen(): AppsOpenRequest | null {
  const taken = pending;
  pending = null;
  return taken;
}

/**
 * Asks the Sessions page to open a session.
 *
 * @param uid - The session.
 */
export function requestSessionOpen(uid: string): void {
  window.dispatchEvent(
    new CustomEvent<string>(OPEN_SESSION_EVENT, { detail: uid })
  );
}
