/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Sessions page's view model (DESKTOP DK-07, DK-09): the merged list
 * the main process answers (`sessions:list`, agent-runtimes'
 * `portable/sessionList`: the places, the groups by application, each row
 * as `loop sessions list` prints it, the elsewhere rule) paged for the
 * page; what opening a row does — the kept deployment of its application,
 * or the local runtime of its folder, started first when it is not
 * running — and the sentences said when it cannot: a session held in VS
 * Code or a terminal (decision D-12), a folder unknown (DK-26), an
 * application not kept always on.
 *
 * Pure: no React, no `window`, no network. The page fetches and draws.
 *
 * @module renderer/pages/sessionsPage
 */

import {
  type SessionState,
  sessionStateSaid,
} from '@datalayer/agent-runtimes/lib/portable/activity';
import {
  type PlaceGroup,
  resumeRefusal,
  type SessionEntry,
  type SessionGroup,
  type SessionPlace,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type { AppChatChoice, AppChatHandle } from '../../shared/appChat';
import type { LocalRuntimeInfo } from '../../shared/types/ipc.types';

/** What the page says. */
export const SESSIONS_WORDS = {
  title: 'Sessions',
  showMore: (left: number): string =>
    `Show ${Math.min(left, PAGE_SIZE)} more (${left} left)`,
  resumeFolderUnknown: (uid: string): string =>
    `${uid} runs in a folder this runtime does not name yet: open the folder it was started in (File → Work in a folder…), then resume it.`,
  noDeployment: (title: string): string =>
    `${title || 'This session'} runs on Datalayer, and its application is not kept always on: turn on Always on in its Ship tab, then open it again.`,
  opened: (title: string, state: string): string =>
    `${title || 'This session'} (${state}): its conversation is open here.`,
  startingRuntime: (folder: string): string =>
    `Starting the local runtime of ${folder}…`,
  pickASession: 'Pick a session on the left, or start one.',
  signedOut: 'Sign in to Datalayer to see your sessions there.',
  workInFolder: 'Work in a folder…',
  newOnDatalayer: 'New session on Datalayer…',
  importSession: 'Import…',
  refresh: 'Refresh',
  filters: 'Filters',
  anyPlace: 'Both places',
  onDatalayer: 'On Datalayer',
  onThisMachine: 'On this machine',
  anyState: 'Any state',
  app: 'Application',
  titleFilter: 'Title',
  waiting: (count: number): string =>
    `${count} request${count === 1 ? '' : 's'} waiting for you`,
  deploymentsRefused: (why: string): string =>
    `Your applications on Datalayer could not be listed: ${why}`,
} as const;

/** How many rows a page shows before *Show more*. */
export const PAGE_SIZE = 50;

/** The places as the list draws them: the first `shown` rows across them, the rest counted. */
export function drawPlaces(
  places: readonly PlaceGroup[],
  shown: number = PAGE_SIZE
): { places: PlaceGroup[]; left: number } {
  let budget = shown;
  let left = 0;
  const drawn: PlaceGroup[] = [];
  for (const place of places) {
    const groups: SessionGroup<SessionEntry>[] = [];
    for (const group of place.groups) {
      const taken = group.sessions.slice(0, Math.max(budget, 0));
      left += group.sessions.length - taken.length;
      budget -= taken.length;
      if (taken.length > 0) {
        groups.push({ application: group.application, sessions: taken });
      }
    }
    drawn.push({ place: place.place, groups, note: place.note });
  }
  return { places: drawn, left };
}

/** Every listed session, by uid. */
export function entriesByUid(
  places: readonly PlaceGroup[]
): Map<string, SessionEntry> {
  const entries = new Map<string, SessionEntry>();
  for (const place of places) {
    for (const group of place.groups) {
      for (const entry of group.sessions) {
        entries.set(entry.row.uid, entry);
      }
    }
  }
  return entries;
}

/** The last segment of a folder's path. */
export function folderNameOf(folder: string): string {
  const trimmed = folder.replace(/[\\/]+$/, '');
  const at = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return at >= 0 ? trimmed.slice(at + 1) : trimmed;
}

/** A local runtime as a place. */
export function localPlaceOf(
  runtime: Pick<LocalRuntimeInfo, 'folder' | 'folderName' | 'url'>
): Extract<SessionPlace, { kind: 'local' }> {
  return {
    kind: 'local',
    folder: runtime.folder,
    folderName: runtime.folderName || folderNameOf(runtime.folder),
    url: runtime.url,
  };
}

/** What the chat opens: a session on a local runtime, or on a kept deployment. */
export type ChatTarget =
  | {
      kind: 'local';
      uid: string;
      /** The agent the session's conversation goes to (the row's). */
      agent: string;
      place: Extract<SessionPlace, { kind: 'local' }>;
      title: string;
      state: SessionState;
    }
  | {
      kind: 'datalayer';
      uid: string;
      handle: AppChatHandle;
      place: Extract<SessionPlace, { kind: 'datalayer' }>;
      title: string;
      state: SessionState;
    };

/** A target, the folder's runtime to start first, or the sentence when the row cannot be opened. */
export type OpenDecision =
  | { target: ChatTarget; startFolder?: undefined; said: string }
  | { target: null; startFolder: string; said: string }
  | { target: null; startFolder?: undefined; said: string };

/**
 * What opening a row does: a session on this machine opens on the runtime
 * holding it, else on the runtime of its folder — running, or started
 * first — unless it is held in VS Code or a terminal (D-12: refused until
 * paused) or ended; a session on Datalayer opens on the kept deployment of
 * its application, or says why not.
 */
export function openDecision(
  entry: SessionEntry,
  running: readonly Pick<LocalRuntimeInfo, 'folder' | 'folderName' | 'url'>[],
  deployments: readonly AppChatChoice[]
): OpenDecision {
  const { row, place } = entry;
  const said = SESSIONS_WORDS.opened(row.title, sessionStateSaid(row));
  if (place.kind === 'local') {
    const refused = resumeRefusal(entry);
    if (refused) {
      return { target: null, said: refused };
    }
    const at =
      row.held === true
        ? place
        : entry.workspace
          ? running.find(runtime => runtime.folder === entry.workspace)
          : undefined;
    if (at) {
      return {
        target: {
          kind: 'local',
          uid: row.uid,
          agent: row.agent,
          place: localPlaceOf(at),
          title: row.title,
          state: row.state,
        },
        said,
      };
    }
    if (!entry.workspace) {
      return {
        target: null,
        said: SESSIONS_WORDS.resumeFolderUnknown(row.uid),
      };
    }
    return { target: null, startFolder: entry.workspace, said };
  }
  const deployment = deployments.find(
    choice =>
      choice.kind === 'talk' &&
      Boolean(row.appUid) &&
      choice.handle.appUid === row.appUid
  );
  if (!deployment || deployment.kind !== 'talk') {
    return { target: null, said: SESSIONS_WORDS.noDeployment(row.title) };
  }
  return {
    target: {
      kind: 'datalayer',
      uid: row.uid,
      handle: deployment.handle,
      place: { kind: 'datalayer' },
      title: row.title,
      state: row.state,
    },
    said,
  };
}

/** The accept list `dialog:open-file` takes from what the chat asks (`.jsonl,application/x-ndjson`): the extensions, without dots. */
export function acceptedExtensionsOf(accept: string): string[] {
  const extensions = accept
    .split(',')
    .map(item => item.trim())
    .filter(item => item.startsWith('.'))
    .map(item => item.slice(1))
    .filter(Boolean);
  return extensions.length > 0 ? extensions : ['jsonl'];
}
