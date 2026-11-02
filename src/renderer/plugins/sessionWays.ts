/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The ways the app's session entries do their work: the Finder through
 * the main process (`window.desktopAPI`), the Apps tab brought to the
 * front on the application (`requestAppsOpen`), the place of a
 * session and a text asked through the Sessions page, which installs them
 * while it is mounted. The Reactor is registered before any page mounts,
 * so the entries reach the page through here rather than holding it.
 *
 * @module renderer/plugins/sessionWays
 */

import type { DesktopSessionWays } from './desktopSessionActions';
import { requestAppsOpen } from '../pages/appsEvents';

/** What the Sessions page lends: the places it knows, a text asked. */
export type PageSessionWays = Pick<DesktopSessionWays, 'placeOf' | 'askText'>;

let page: PageSessionWays | null = null;

/** The page installs its ways while mounted; `null` takes them away. */
export function setPageSessionWays(ways: PageSessionWays | null): void {
  page = ways;
}

/** The sentence when an entry needs the page and none is open. */
export const NO_PAGE_SENTENCE =
  'Open the Sessions page to do this: it holds the session.';

/** The ways handed to the entries: the page's when installed, the main process's. */
export const desktopWays: DesktopSessionWays = {
  placeOf: uid => page?.placeOf(uid),
  askText: (title, value) => {
    if (!page) {
      return Promise.reject(new Error(NO_PAGE_SENTENCE));
    }
    return page.askText(title, value);
  },
  reveal: path => window.desktopAPI.shell.reveal(path),
  openApps: async appUid => {
    requestAppsOpen({ appUid, section: 'activity' });
  },
};
