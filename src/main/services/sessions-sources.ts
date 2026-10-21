/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The two sources of the sessions list (DESKTOP DK-09), read by the main
 * process: the person's sessions **on Datalayer** — the record, through
 * ai-agents' `GET /api/ai-agents/v1/apps/sessions?opened_by=` with the
 * token this process holds — and **on this machine** — each running local
 * runtime's `GET /api/v1/apps/sessions` over loopback, with no token (the
 * file store is one, so any runtime lists every local session, `held` true
 * only for its own). The rows and the merge are agent-runtimes'
 * `portable/sessionList.ts` (DK-25); the renderer gets the merged places
 * over `sessions:list` and never the token.
 *
 * A local row's folder comes with the row (`workspace`, agent-runtimes
 * 1.5.71, DK-26); until that release, a row held by a runtime of the app
 * is read again at `GET /sessions/{uid}` for its `harness_session`'s
 * workspace, and a row nobody holds says *folder unknown*.
 *
 * @module main/services/sessions-sources
 */

import log from 'electron-log/main';
import { DEFAULT_PLANE_URLS } from '@datalayer/core/lib/config/planes';
import {
  attentionRowsOf,
  datalayerSessionsUrl,
  type ListedSession,
  listedSessionOf,
  listedSessionsOf,
  LOCAL_SESSIONS_PATH,
  mergePlaces,
  NO_LOCAL_SESSION_YET,
  noLocalRuntimeSentence,
  type SessionAttention,
  type SessionFilter,
  type SessionPlace,
  type SessionsOfPlace,
  SIGNED_OUT_SENTENCE,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type {
  LocalRuntimeInfo,
  RememberedFolders,
  SessionsListed,
} from '../../shared/types/ipc.types';
import { localRuntimes } from './local-runtime';
import { sdkBridge } from './datalayer-sdk-bridge';

/** What the sources read from, so the tests give their own. */
export interface SessionsSourcesDeps {
  /** The person's token, their uid and ai-agents' base URL when signed in; null otherwise. */
  signedIn: () => { token: string; uid: string; aiAgentsUrl: string } | null;
  /** The local runtimes running now. */
  runtimes: () => LocalRuntimeInfo[];
  folders: () => RememberedFolders;
  fetch: typeof fetch;
  log: (line: string) => void;
}

/** The sources: the list, and the rows a watcher reads from it. */
export interface SessionsSources {
  /** The two places merged, the filter applied. */
  list(filter?: SessionFilter): Promise<SessionsListed>;
  /** The sessions of both places as last listed, for the OS's attention (DK-14). */
  lastRows(): SessionAttention[];
}

/** The sentence when ai-agents refuses or fails, with its words. */
async function refusal(response: Response, what: string): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { detail?: unknown };
    detail = typeof body.detail === 'string' ? body.detail : '';
  } catch {
    // The status says it.
  }
  return detail || `${what} answered ${response.status}.`;
}

/**
 * The sources over their dependencies.
 *
 * @param deps - The sign-in, the runtimes, the folders, `fetch`.
 *
 * @returns The sources.
 */
export function createSessionsSources(
  deps: SessionsSourcesDeps
): SessionsSources {
  let lastRows: SessionAttention[] = [];

  const datalayer = async (): Promise<SessionsOfPlace> => {
    const place: SessionPlace = { kind: 'datalayer' };
    const signedIn = deps.signedIn();
    if (!signedIn) {
      return { place, sessions: [] };
    }
    try {
      const response = await deps.fetch(
        datalayerSessionsUrl(signedIn.aiAgentsUrl, signedIn.uid),
        { headers: { Authorization: `Bearer ${signedIn.token}` } }
      );
      if (!response.ok) {
        return { place, problem: await refusal(response, 'ai-agents') };
      }
      return { place, sessions: listedSessionsOf(await response.json()) };
    } catch (error) {
      return {
        place,
        problem: error instanceof Error ? error.message : String(error),
      };
    }
  };

  /** A held row's folder read again at `GET /sessions/{uid}` when the list's row names none (before 1.5.71). */
  const withWorkspace = async (
    url: string,
    listed: ListedSession
  ): Promise<ListedSession> => {
    if (listed.workspace || listed.row.held !== true || !listed.row.harness) {
      return listed;
    }
    try {
      const response = await deps.fetch(
        `${url}${LOCAL_SESSIONS_PATH}/${encodeURIComponent(listed.row.uid)}`
      );
      if (!response.ok) {
        return listed;
      }
      const described = listedSessionOf(
        (await response.json()) as Record<string, unknown>
      );
      return described.workspace
        ? { ...listed, workspace: described.workspace }
        : listed;
    } catch (error) {
      deps.log(
        `The folder of ${listed.row.uid} could not be read at ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
      return listed;
    }
  };

  /**
   * This machine's sessions: one place per running runtime with what it
   * holds; the sessions held by none of them (paused, ended, or open in
   * VS Code or a terminal) listed once, under the first runtime's place.
   */
  const local = async (): Promise<SessionsOfPlace[]> => {
    const runtimes = deps.runtimes();
    const places: SessionsOfPlace[] = [];
    const heldByOurs = new Set<string>();
    const answers: Array<{
      runtime: LocalRuntimeInfo;
      sessions: ListedSession[];
    }> = [];
    for (const runtime of runtimes) {
      const place: SessionPlace = {
        kind: 'local',
        folder: runtime.folder,
        folderName: runtime.folderName,
        url: runtime.url,
      };
      try {
        const response = await deps.fetch(
          `${runtime.url}${LOCAL_SESSIONS_PATH}`
        );
        if (!response.ok) {
          places.push({
            place,
            problem: `the runtime answered ${response.status}`,
          });
          continue;
        }
        const sessions = listedSessionsOf(await response.json());
        for (const listed of sessions) {
          if (listed.row.held === true) {
            heldByOurs.add(listed.row.uid);
          }
        }
        answers.push({ runtime, sessions });
        places.push({ place, sessions: [] });
      } catch (error) {
        places.push({
          place,
          problem: error instanceof Error ? error.message : String(error),
        });
      }
    }
    let unheldListed = false;
    for (const { runtime, sessions } of answers) {
      const place = places.find(
        candidate =>
          candidate.place.kind === 'local' &&
          candidate.place.url === runtime.url
      );
      if (!place || place.problem !== undefined) {
        continue;
      }
      const kept: ListedSession[] = [];
      for (const listed of sessions) {
        if (listed.row.held === true) {
          kept.push(await withWorkspace(runtime.url, listed));
        } else if (!unheldListed && !heldByOurs.has(listed.row.uid)) {
          kept.push(listed);
        }
      }
      unheldListed = true;
      place.sessions = kept;
    }
    return places;
  };

  return {
    async list(filter) {
      const signedIn = deps.signedIn() !== null;
      const [recorded, held] = await Promise.all([datalayer(), local()]);
      const places = mergePlaces([recorded, ...held], filter);
      const first = places[0];
      if (first && first.place.kind === 'datalayer' && !signedIn) {
        first.note = SIGNED_OUT_SENTENCE;
      }
      const folders = deps.folders();
      if (held.length === 0 && (!filter?.place || filter.place === 'local')) {
        places.push({
          place: {
            kind: 'local',
            folder: folders.last ?? '',
            folderName: folders.last
              ? folders.last.split(/[\\/]/).pop() || folders.last
              : 'this machine',
            url: '',
          },
          groups: [],
          note: folders.last
            ? noLocalRuntimeSentence('File → Work in a folder…')
            : NO_LOCAL_SESSION_YET,
        });
      }
      lastRows = attentionRowsOf([
        ...(recorded.sessions ?? []),
        ...held.flatMap(place => place.sessions ?? []),
      ]);
      return { places, signedIn, folders };
    },
    lastRows: () => lastRows,
  };
}

/** The app's sources: the SDK bridge's sign-in, the local runtimes, `fetch`. */
export const sessionsSources: SessionsSources = createSessionsSources({
  signedIn: () => {
    if (!sdkBridge.isAuthenticated()) {
      return null;
    }
    const state = sdkBridge.getAuthState();
    const uid =
      state.user && typeof (state.user as { uid?: unknown }).uid === 'string'
        ? (state.user as { uid: string }).uid
        : '';
    if (!state.token || !uid) {
      return null;
    }
    return {
      token: state.token,
      uid,
      aiAgentsUrl:
        process.env.DATALAYER_AI_AGENTS_URL || DEFAULT_PLANE_URLS.aiAgentsUrl,
    };
  },
  runtimes: () => localRuntimes.infos(),
  folders: () => localRuntimes.folders(),
  fetch: (input, init) => fetch(input, init),
  log: line => log.info(`[Sessions] ${line}`),
});
