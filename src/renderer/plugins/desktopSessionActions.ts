/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * What Datalayer Desktop adds to a session's menu through Agent Runtimes'
 * `loop.session.action` point, beside the chat's own entries (*Switch
 * agent…*, *Clone from here*, *Export*, *Import…*, *Resume*): *Rename…*,
 * *Archive* and *End* on the session API, *Reveal in Finder* for a session
 * on this machine (its folder, shown by the OS) and *Open in Apps*
 * for a session of an application (its Activity, in the Apps tab).
 * The same entries are drawn in the chat's `⋯` menu and in the list's row
 * menu, from the one registry; nothing of the menu is copied here.
 *
 * Each entry does its work through the ways the page lends it (a text
 * asked, the OS's Finder, the Apps tab) and says what it did; a refusal
 * of the runtime is thrown as the runtime said it, and the menu shows it
 * whole.
 *
 * Pure: no React, no `window`.
 *
 * @module renderer/plugins/desktopSessionActions
 */

import type {
  SessionActionContribution,
  SessionFacts,
} from '@datalayer/agent-runtimes/lib/apps/core';
import type { SessionPlace } from '@datalayer/agent-runtimes/lib/portable/sessionList';

/** What the entries say. */
export const DESKTOP_SESSION_ACTION_WORDS = {
  rename: 'Rename…',
  renameTitle: 'Rename this session',
  renamed: (title: string): string => `Renamed to ${title}.`,
  archive: 'Archive',
  archived: (uid: string): string =>
    `Archived ${uid}: it is hidden from the list, and its record stays.`,
  end: 'End',
  ended: (uid: string): string =>
    `Ended ${uid}: it cannot be resumed; its record stays.`,
  reveal: 'Reveal in Finder',
  revealed: (folder: string): string => `${folder} is shown in the Finder.`,
  openApps: 'Open in Apps',
  opened: (title: string): string =>
    `${title || 'This conversation'} is listed on Activity, with every session of the application.`,
} as const;

/** The ways the page lends the entries. */
export interface DesktopSessionWays {
  /** The place of a session the page lists or opened; `undefined` for one it does not know. */
  placeOf: (uid: string) => SessionPlace | undefined;
  /** Ask the person for a text; `undefined` when they decline. */
  askText: (title: string, value: string) => Promise<string | undefined>;
  /** Show a folder in the OS's file browser (`shell:reveal`). */
  reveal: (path: string) => Promise<void>;
  /** Bring the Apps tab to the front on an application's Activity. */
  openApps: (appUid: string) => Promise<void>;
}

/** An entry's order among the chat's five (10 to 40) and the landing's (90). */
const ORDER = {
  rename: 50,
  archive: 60,
  end: 70,
  reveal: 80,
  openApps: 90,
} as const;

const notEnded = (session: SessionFacts): boolean => session.state !== 'ended';

/** *Rename…*: a title asked, kept by the session API; not for an ended session. */
export function renameAction(
  ways: Pick<DesktopSessionWays, 'askText'>
): SessionActionContribution {
  return {
    id: 'desktop-rename',
    label: DESKTOP_SESSION_ACTION_WORDS.rename,
    order: ORDER.rename,
    divider: true,
    when: notEnded,
    run: async (session, context) => {
      const title = await ways.askText(
        DESKTOP_SESSION_ACTION_WORDS.renameTitle,
        session.title
      );
      if (title === undefined) {
        return;
      }
      await context.client.rename(session.uid, title);
      context.say(DESKTOP_SESSION_ACTION_WORDS.renamed(title));
    },
  };
}

/** *Archive*: hidden from the list; for a session not archived yet. */
export const ARCHIVE_ACTION: SessionActionContribution = {
  id: 'desktop-archive',
  label: DESKTOP_SESSION_ACTION_WORDS.archive,
  order: ORDER.archive,
  when: session => !session.archived,
  run: async (session, context) => {
    await context.client.archive(session.uid, true);
    context.say(DESKTOP_SESSION_ACTION_WORDS.archived(session.uid));
  },
};

/** *End*: the conversation ended for good; not for one ended already. */
export const END_ACTION: SessionActionContribution = {
  id: 'desktop-end',
  label: DESKTOP_SESSION_ACTION_WORDS.end,
  order: ORDER.end,
  when: notEnded,
  run: async (session, context) => {
    await context.client.end(session.uid);
    context.say(DESKTOP_SESSION_ACTION_WORDS.ended(session.uid));
  },
};

/** *Reveal in Finder*: the folder a session on this machine works in. */
export function revealInFinderAction(
  ways: Pick<DesktopSessionWays, 'placeOf' | 'reveal'>
): SessionActionContribution {
  return {
    id: 'desktop-reveal-in-finder',
    label: DESKTOP_SESSION_ACTION_WORDS.reveal,
    order: ORDER.reveal,
    divider: true,
    when: session => ways.placeOf(session.uid)?.kind === 'local',
    run: async (session, context) => {
      const place = ways.placeOf(session.uid);
      if (place?.kind !== 'local') {
        return;
      }
      await ways.reveal(place.folder);
      context.say(DESKTOP_SESSION_ACTION_WORDS.revealed(place.folder));
    },
  };
}

/** *Open in Apps*: the application's Activity, in the Apps tab. */
export function openInAppsAction(
  ways: Pick<DesktopSessionWays, 'openApps'>
): SessionActionContribution {
  return {
    id: 'desktop-open-in-apps',
    label: DESKTOP_SESSION_ACTION_WORDS.openApps,
    order: ORDER.openApps,
    when: session => Boolean(session.appUid),
    run: async (session, context) => {
      await ways.openApps(session.appUid);
      context.say(DESKTOP_SESSION_ACTION_WORDS.opened(session.title));
    },
  };
}

/** The app's entries, in their order. */
export function desktopSessionActions(
  ways: DesktopSessionWays
): SessionActionContribution[] {
  return [
    renameAction(ways),
    ARCHIVE_ACTION,
    END_ACTION,
    revealInFinderAction(ways),
    openInAppsAction(ways),
  ];
}
