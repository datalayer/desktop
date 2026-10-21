/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * How another part of the app asks the Studio to open an application on a
 * section (*Open in the Studio*, DESKTOP DK-02) and the Sessions page to
 * open a session (a row of the Studio's Activity). Light on purpose: the
 * app shell and the session entries import it without the Studio's page.
 *
 * @module renderer/pages/studioEvents
 */

/** The sections of an application, in their order. */
export const STUDIO_SECTIONS = [
  'build',
  'try',
  'activity',
  'deployments',
] as const;

/** One of them. */
export type StudioSection = (typeof STUDIO_SECTIONS)[number];

/** The event that brings the Studio tab to the front on an application. */
export const OPEN_STUDIO_EVENT = 'datalayer:open-studio';

/** The event that brings the Sessions tab to the front on a session. */
export const OPEN_SESSION_EVENT = 'datalayer:open-session';

/** What *Open in the Studio* asks. */
export interface StudioOpenRequest {
  appUid: string;
  section: StudioSection;
}

let pending: StudioOpenRequest | null = null;

/**
 * Asks the Studio to open an application on a section: kept until the page
 * takes it (it may not be mounted yet), and said to the app and the page.
 *
 * @param request - The application and the section.
 */
export function requestStudioOpen(request: StudioOpenRequest): void {
  pending = request;
  window.dispatchEvent(
    new CustomEvent<StudioOpenRequest>(OPEN_STUDIO_EVENT, { detail: request })
  );
}

/**
 * The request not yet taken, taken.
 *
 * @returns It, or null.
 */
export function takeStudioOpen(): StudioOpenRequest | null {
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
