/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * IPC communication types for Electron main-renderer bridge.
 * Re-exports SDK types and adds desktop-specific interfaces.
 *
 * @module types/ipc
 */

// Re-export all SDK JSON types for convenience
export type {
  RuntimeJSON,
  EnvironmentJSON,
  NotebookJSON,
  LexicalJSON,
  SpaceJSON,
  UserJSON,
} from '@datalayer/agent-runtimes/lib/models';
import type { UserJSON } from '@datalayer/agent-runtimes/lib/models';

/**
 * Authentication state shared between main and renderer processes.
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: UserJSON | null;
  token: string | null;
  runUrl: string;
}

/**
 * Serialized data that can be safely sent over IPC.
 * SDK models handle serialization via toJSON(), so this is just unknown.
 */
export type SerializedData = unknown;

// ---------------------------------------------------------------------------
// Sessions (DESKTOP §7): the IPC contract between the main process and the
// renderer — the channels named in the plan, their shapes. The renderer
// reaches them through `window.desktopAPI` (the preload); the main process
// answers them (`src/main/services/*`). Shapes the two sides build against.
// ---------------------------------------------------------------------------

import type { SessionRow } from '@datalayer/agent-runtimes/lib/portable/activity';

/** Where a session runs: Datalayer's record, or a local runtime of one folder. */
export type SessionPlace =
  | { kind: 'datalayer' }
  | {
      kind: 'local';
      /** The folder the runtime works in. */
      folder: string;
      /** Its last segment. */
      folderName: string;
      /** The runtime's address (`http://127.0.0.1:<port>`). */
      url: string;
    };

/** The application a session belongs to, as the list groups it. */
export interface SessionApplication {
  /** The application's uid, else its id on the runtime, else empty. */
  key: string;
  /** Its name, else its id, else its uid. */
  name: string;
}

/**
 * A session as `sessions:list` answers it: the row as the session API and
 * the record say it (`sessionRowOf`), its application, and, for a session
 * on this machine, the folder it works in (`workspace`, DK-26; `''` while
 * the runtime does not say it).
 */
export interface ListedSession {
  row: SessionRow;
  application: SessionApplication;
  workspace: string;
}

/** One place's sessions, or the sentence when the place did not answer. */
export interface SessionsPlaceListed {
  place: SessionPlace;
  sessions: ListedSession[];
  /** What went wrong, the server's words; `''` when the place answered. */
  problem: string;
}

/** `sessions:list` → the places, Datalayer first, then each local runtime running. */
export interface SessionsListed {
  places: SessionsPlaceListed[];
  /** Whether the person is signed in: the Datalayer place is listed only then. */
  signedIn: boolean;
}

/** `local-runtime:start {folder}` → the runtime of that folder. */
export interface LocalRuntimeStarted {
  folder: string;
  folderName: string;
  url: string;
}

/** A harness of the local runtime's catalogue (`GET /api/v1/harnesses`), as the picker shows it. */
export interface HarnessListed {
  /** `claude-code`, `codex`, … */
  id: string;
  /** *Claude Code*. */
  name: string;
  /** The credential it takes, the register's words; `''` for none. */
  credential: string;
  /** The credential names it declares (`ANTHROPIC_API_KEY`). */
  secrets: string[];
  /** `api_key_only`, `permitted`, `organizations_own`. */
  servedToThirdParties: string;
  /** The licence, the register's words. */
  licence: string;
  /** Tier restrictions, or `''`. */
  tierRestrictions: string;
  /** The adapter pinned, and its version; `''` when none. */
  adapter: string;
  adapterVersion: string;
  /** The instructions file the harness reads (`CLAUDE.md`); `''` when none. */
  instructionsFile: string;
}

/** One part of the machine's check for a harness (DK-06): node, the adapter, the credential. */
export interface HarnessCheckPart {
  name: string;
  ok: boolean;
  /** The sentence, the register's words. */
  said: string;
}

/** `local-runtime:check-harness {url, id}` → what the machine has for it. */
export interface HarnessChecked {
  ok: boolean;
  parts: HarnessCheckPart[];
  /** The `agent-shield setup` line offered for the missing part; `''` when nothing is missing. */
  setup: string;
  /** The register's refusal when the harness's terms refuse the person's credential; `''` otherwise. */
  refused: string;
}

/** An approval waiting for the person, from either place (`approvals:pending`). */
export interface ApprovalPending {
  place: SessionPlace;
  id: string;
  toolName: string;
  toolDescription?: string;
  args: Record<string, unknown>;
  agentId: string;
  requestedAt: string;
  /** The session asking, when the place says it; `''` otherwise. */
  sessionUid: string;
}

/** `approvals:decide {place, id, decision}` → what the place answered. */
export interface ApprovalDecided {
  /** `200` done; `409` answered elsewhere; `404` gone. */
  status: number;
  /** The sentence shown to the person. */
  said: string;
}

/** The decision sent for an approval. */
export type ApprovalDecision = 'approve' | 'reject';

/**
 * The menu actions the Sessions page listens to (`menu-action`, as the
 * menu already sends them): File → Work in a folder…, New session on
 * Datalayer…, Import a session…, Stop the local runtime; Sessions →
 * Resume last, Export…; View → Sessions.
 */
export const SESSIONS_MENU_ACTIONS = {
  workInFolder: 'sessions:work-in-folder',
  newOnDatalayer: 'sessions:new-on-datalayer',
  importSession: 'sessions:import',
  stopLocalRuntime: 'local-runtime:stop',
  resumeLast: 'sessions:resume-last',
  exportSession: 'sessions:export',
  viewSessions: 'view:sessions',
} as const;

export type SessionsMenuAction =
  (typeof SESSIONS_MENU_ACTIONS)[keyof typeof SESSIONS_MENU_ACTIONS];

/** What the preload exposes as `window.desktopAPI`: the contract, typed. */
export interface DesktopAPI {
  sessions: {
    /** `sessions:list`. */
    list: () => Promise<SessionsListed>;
    /** `sessions:changed`: a place's sessions changed; the page reads again. */
    onChanged: (callback: () => void) => () => void;
  };
  localRuntime: {
    /** `local-runtime:start {folder}`: the folder's runtime, started if need be. */
    start: (folder: string) => Promise<LocalRuntimeStarted>;
    /** `local-runtime:stop {folder}`; every runtime when no folder is named. */
    stop: (folder?: string) => Promise<void>;
    /** `local-runtime:running`: the runtimes running now. */
    running: () => Promise<LocalRuntimeStarted[]>;
    /** `local-runtime:recent-folders`: the last ten folders worked in, newest first. */
    recentFolders: () => Promise<string[]>;
    /** `local-runtime:harnesses {url}`: the runtime's catalogue. */
    harnesses: (url: string) => Promise<HarnessListed[]>;
    /** `local-runtime:check-harness {url, id}`: the machine checked for it. */
    checkHarness: (url: string, id: string) => Promise<HarnessChecked>;
    /** `local-runtime:setup-harness {url, id}`: `agent-shield setup` run; its output, or its refusal thrown. */
    setupHarness: (url: string, id: string) => Promise<string>;
    /** `credentials:store {name, value}`: a credential kept in the app's keychain; `''` forgets it. */
    storeCredential: (name: string, value: string) => Promise<void>;
  };
  approvals: {
    /** `approvals:pending`. */
    pending: () => Promise<ApprovalPending[]>;
    /** `approvals:decide {place, id, decision}`. */
    decide: (
      place: SessionPlace,
      id: string,
      decision: ApprovalDecision
    ) => Promise<ApprovalDecided>;
    /** `approvals:changed`: the pending list changed. */
    onChanged: (callback: () => void) => () => void;
  };
  dialog: {
    /** `dialog:open-folder`: a folder picked, or `undefined`. */
    openFolder: () => Promise<string | undefined>;
    /** `dialog:save {name, text}`: the file written, or `undefined` when declined. */
    save: (name: string, text: string) => Promise<string | undefined>;
    /** `dialog:open-file {accept}`: the file's text, or `undefined` when declined. */
    openFile: (accept: string) => Promise<string | undefined>;
  };
  shell: {
    /** `shell:reveal {path}`. */
    reveal: (path: string) => Promise<void>;
  };
  studio: {
    /** `studio:open {path}`: the embedded Studio sent to a page of the landing. */
    open: (path: string) => Promise<void>;
  };
  attention: {
    /** `attention:focus {uid}`: the main process asks the page to show a session. */
    onFocus: (callback: (uid: string) => void) => () => void;
  };
}
