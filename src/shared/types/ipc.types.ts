/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The IPC contract between the main process and the renderer: the channels
 * by name, the shape each one takes and answers, and the readers that
 * refuse a wrong shape at the boundary in a sentence (fail fast — a handler
 * never guesses what the other side meant).
 *
 * Sessions (DESKTOP §7, the day-one contract): `local-runtime:*`,
 * `sessions:*`, `approvals:*`, `dialog:*`, `shell:reveal`, `studio:*`,
 * `attention:*`. The pure logic of the rows and the merge is not here but
 * in agent-runtimes `portable/` (decision D-13); these are the shapes that
 * travel.
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
import type {
  CredentialSource,
  HarnessCheck,
  HarnessFacts,
} from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import type {
  PlaceGroup,
  SessionFilter,
  SessionPlace,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type { StudioStateChange } from '../studio';
export type {
  StudioApp,
  StudioAppDocument,
  StudioAppsListed,
  StudioDeployment,
  StudioStateChange,
} from '../studio';

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
// The channels (DESKTOP §7)
// ---------------------------------------------------------------------------

/** Every channel of the sessions contract, by name: `ipcMain.handle` ones and the events the main process sends. */
export const IPC = {
  /** `{folder}` → {@link LocalRuntimeInfo}: the folder's runtime, started when it is not running. */
  localRuntimeStart: 'local-runtime:start',
  /** `{folder?}` → void: that folder's runtime, or every runtime. */
  localRuntimeStop: 'local-runtime:stop',
  /** → {@link LocalRuntimeInfo}[]: the runtimes running now. */
  localRuntimeList: 'local-runtime:list',
  /** `{folder?}` → {@link HarnessFacts}[]: the catalogue from a running runtime's `GET /api/v1/harnesses`. */
  localRuntimeHarnesses: 'local-runtime:harnesses',
  /** `{harness}` → {@link HarnessCheckResult}: what the machine has for it (DK-06). */
  localRuntimeCheckHarness: 'local-runtime:check-harness',
  /** → {@link RememberedFolders}: the last ten folders worked in, the last one first. */
  localRuntimeFolders: 'local-runtime:folders',
  /** Event: a local runtime started or stopped; the renderer lists again. */
  localRuntimeChanged: 'local-runtime:changed',
  /** `{name, value}` → void: a credential kept in the app's keychain; an empty value forgets it. Never logged. */
  credentialsSet: 'credentials:set',
  /** `{name}` → boolean: whether the keychain holds it (never the value). */
  credentialsHas: 'credentials:has',
  /** `{filter?}` → {@link SessionsListed}: the two places merged. */
  sessionsList: 'sessions:list',
  /** Event: something changed that the list should show again. */
  sessionsChanged: 'sessions:changed',
  /** → {@link PendingApproval}[]: what waits for the person, both places. */
  approvalsPending: 'approvals:pending',
  /** {@link ApprovalDecision} → {@link ApprovalDecided}. */
  approvalsDecide: 'approvals:decide',
  /** Event: the pending list changed; the payload is the new list. */
  approvalsChanged: 'approvals:changed',
  /** → {@link FolderPicked} | null: the OS folder picker, the folder remembered. */
  dialogOpenFolder: 'dialog:open-folder',
  /** `{name, text}` → {@link FileSaved} | null: the OS save dialog, the text written. */
  dialogSave: 'dialog:save',
  /** `{accept}` → {@link FileOpened} | null: the OS open dialog, the file read as text. */
  dialogOpenFile: 'dialog:open-file',
  /** `{path}` → void: the file or folder shown in Finder, Explorer or the file manager. */
  shellReveal: 'shell:reveal',
  /** → {@link StudioAppsListed}: the person's applications and the landing's origin (DK-02). */
  studioApps: 'studio:apps',
  /** `{uid}` → {@link StudioAppDocument}: one application's Appspec. */
  studioApp: 'studio:app',
  /** → {@link StudioDeployment}[]: the person's deployments at ai-agents. */
  studioDeployments: 'studio:deployments',
  /** {@link StudioStateChange} → {@link StudioDeployment}: a deployment paused or resumed, for one version. */
  studioDeploymentState: 'studio:deployment-state',
  /** `{uid}` renderer → main (invoke, answers nothing): the session the chat shows now, or null — it is never notified (DK-14). */
  attentionFront: 'attention:front',
  /** Event main → renderer {@link AttentionFocus}: a notification or the tray was clicked; the renderer opens that session, or the approval's. */
  attentionFocus: 'attention:focus',
} as const;

/** One of the channels. */
export type IpcChannel = (typeof IPC)[keyof typeof IPC];

// ---------------------------------------------------------------------------
// The shapes
// ---------------------------------------------------------------------------

/** A local runtime running for one folder, as the renderer sees it (no pid, no path). */
export interface LocalRuntimeInfo {
  folder: string;
  folderName: string;
  /** `http://127.0.0.1:<port>`. */
  url: string;
  port: number;
  /** agent-runtimes' version, as `loop --version` said it. */
  version: string;
  /** Where each declared credential came from (O-2). */
  credentials: Record<string, CredentialSource>;
}

/** The folders worked in, remembered across launches. */
export interface RememberedFolders {
  /** The last ten, the most recent first. */
  folders: string[];
  /** The last folder worked in, whose runtime starts at launch (O-7); null when none. */
  last: string | null;
}

/** What `local-runtime:check-harness` answers: the verdict and the command `setup` would run. */
export interface HarnessCheckResult {
  harness: HarnessFacts;
  check: HarnessCheck;
  /** Which credential source was used, said (O-2), or empty when none was found. */
  credentialSaid: string;
}

/** What `sessions:list` answers. */
export interface SessionsListed {
  /** The places in order, Datalayer first, each with its groups or its note. */
  places: PlaceGroup[];
  signedIn: boolean;
  folders: RememberedFolders;
}

/** A pending approval of either place, as the banner and the OS say it. */
export interface PendingApproval {
  place: SessionPlace;
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  agentId: string;
  requestedAt: string;
  /** The application asking, in words: the deployment's name, or *The coding agent in <folder>*. */
  app: string;
}

/** A decision on an approval, from the renderer. */
export interface ApprovalDecision {
  place: SessionPlace;
  id: string;
  decision: 'approve' | 'reject';
  note?: string;
}

/** What a decision came to, in a sentence (done, answered elsewhere, gone, refused). */
export interface ApprovalDecided {
  said: string;
}

/** What `attention:focus` carries: a session to open, or an approval to show whole in its chat. */
export type AttentionFocus =
  | { uid: string; approval?: undefined }
  | { uid?: undefined; approval: PendingApproval };

/** A folder picked. */
export interface FolderPicked {
  folder: string;
  folderName: string;
}

/** A file written where the person chose. */
export interface FileSaved {
  path: string;
}

/** A file read as text. */
export interface FileOpened {
  name: string;
  path: string;
  text: string;
}

// ---------------------------------------------------------------------------
// The readers at the boundary
// ---------------------------------------------------------------------------

const record = (value: unknown, channel: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `${channel} takes an object, not ${JSON.stringify(value)}.`
    );
  }
  return value as Record<string, unknown>;
};

const text = (
  value: Record<string, unknown>,
  name: string,
  channel: string
): string => {
  const read = value[name];
  if (typeof read !== 'string' || !read.trim()) {
    throw new Error(`${channel} takes ${name} as a non-empty string.`);
  }
  return read;
};

const optionalText = (
  value: Record<string, unknown>,
  name: string,
  channel: string
): string | undefined => {
  const read = value[name];
  if (read === undefined || read === null) {
    return undefined;
  }
  if (typeof read !== 'string') {
    throw new Error(`${channel} takes ${name} as a string when given.`);
  }
  return read;
};

/** `local-runtime:start {folder}`: the folder, required. */
export function readFolder(value: unknown, channel: string): string {
  return text(record(value, channel), 'folder', channel);
}

/** `local-runtime:stop {folder?}`, `local-runtime:harnesses {folder?}`: the folder when named. */
export function readOptionalFolder(
  value: unknown,
  channel: string
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return optionalText(record(value, channel), 'folder', channel);
}

/** `local-runtime:check-harness {harness}`. */
export function readHarness(value: unknown): string {
  return text(
    record(value, IPC.localRuntimeCheckHarness),
    'harness',
    IPC.localRuntimeCheckHarness
  );
}

/** A credential's name: upper-case, as the harness specs declare them. */
export const CREDENTIAL_NAME = /^[A-Z][A-Z0-9_]*$/;

/** `credentials:set {name, value}`: the value may be empty (forgets it), never anything but a string. */
export function readCredential(value: unknown): {
  name: string;
  value: string;
} {
  const given = record(value, IPC.credentialsSet);
  const name = text(given, 'name', IPC.credentialsSet);
  if (!CREDENTIAL_NAME.test(name)) {
    throw new Error(
      `${IPC.credentialsSet} takes a credential's name as the harness declares it (ANTHROPIC_API_KEY), not ${JSON.stringify(name)}.`
    );
  }
  const read = given.value;
  if (typeof read !== 'string') {
    throw new Error(`${IPC.credentialsSet} takes value as a string.`);
  }
  return { name, value: read };
}

/** `credentials:has {name}`. */
export function readCredentialName(value: unknown): string {
  const name = text(
    record(value, IPC.credentialsHas),
    'name',
    IPC.credentialsHas
  );
  if (!CREDENTIAL_NAME.test(name)) {
    throw new Error(
      `${IPC.credentialsHas} takes a credential's name as the harness declares it, not ${JSON.stringify(name)}.`
    );
  }
  return name;
}

const SESSION_STATES = ['open', 'paused', 'ended', ''] as const;
const PLACE_KINDS = ['datalayer', 'local', ''] as const;

/** `sessions:list {filter?}`: nothing narrowed when absent. */
export function readFilter(value: unknown): SessionFilter {
  if (value === undefined || value === null) {
    return { app: '', state: '', title: '', place: '' };
  }
  const given = record(value, IPC.sessionsList);
  const filter =
    given.filter === undefined ? given : record(given.filter, IPC.sessionsList);
  const app = optionalText(filter, 'app', IPC.sessionsList) ?? '';
  const title = optionalText(filter, 'title', IPC.sessionsList) ?? '';
  const state = optionalText(filter, 'state', IPC.sessionsList) ?? '';
  const place = optionalText(filter, 'place', IPC.sessionsList) ?? '';
  if (!(SESSION_STATES as readonly string[]).includes(state)) {
    throw new Error(
      `${IPC.sessionsList} narrows to a state of open, paused or ended, not ${JSON.stringify(state)}.`
    );
  }
  if (!(PLACE_KINDS as readonly string[]).includes(place)) {
    throw new Error(
      `${IPC.sessionsList} narrows to a place of datalayer or local, not ${JSON.stringify(place)}.`
    );
  }
  return {
    app,
    title,
    state: state as SessionFilter['state'],
    place: place as SessionFilter['place'],
  };
}

/** A place as it travels: `{kind: 'datalayer'}` or `{kind: 'local', folder, folderName, url}`. */
export function readPlace(value: unknown, channel: string): SessionPlace {
  const given = record(value, channel);
  if (given.kind === 'datalayer') {
    return { kind: 'datalayer' };
  }
  if (given.kind === 'local') {
    const url = text(given, 'url', channel);
    if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(url)) {
      throw new Error(
        `${channel} takes a local place's url as http://127.0.0.1:<port>, not ${JSON.stringify(url)}.`
      );
    }
    return {
      kind: 'local',
      folder: text(given, 'folder', channel),
      folderName: text(given, 'folderName', channel),
      url,
    };
  }
  throw new Error(
    `${channel} takes a place of kind datalayer or local, not ${JSON.stringify(given.kind)}.`
  );
}

/** `approvals:decide {place, id, decision, note?}`. */
export function readDecision(value: unknown): ApprovalDecision {
  const given = record(value, IPC.approvalsDecide);
  const decision = text(given, 'decision', IPC.approvalsDecide);
  if (decision !== 'approve' && decision !== 'reject') {
    throw new Error(
      `${IPC.approvalsDecide} takes a decision of approve or reject, not ${JSON.stringify(decision)}.`
    );
  }
  const note = optionalText(given, 'note', IPC.approvalsDecide);
  return {
    place: readPlace(given.place, IPC.approvalsDecide),
    id: text(given, 'id', IPC.approvalsDecide),
    decision,
    ...(note ? { note } : {}),
  };
}

/** `dialog:save {name, text}`. */
export function readSave(value: unknown): { name: string; text: string } {
  const given = record(value, IPC.dialogSave);
  const name = text(given, 'name', IPC.dialogSave);
  if (/[\\/]/.test(name)) {
    throw new Error(
      `${IPC.dialogSave} takes a file name, not a path: ${JSON.stringify(name)}.`
    );
  }
  if (typeof given.text !== 'string') {
    throw new Error(`${IPC.dialogSave} takes text as a string.`);
  }
  return { name, text: given.text };
}

/** `dialog:open-file {accept}`: the extensions accepted, without dots. */
export function readOpenFile(value: unknown): { accept: string[] } {
  const given = record(value, IPC.dialogOpenFile);
  const accept = given.accept;
  if (
    !Array.isArray(accept) ||
    accept.length === 0 ||
    !accept.every(
      item => typeof item === 'string' && /^[A-Za-z0-9.]+$/.test(item)
    )
  ) {
    throw new Error(
      `${IPC.dialogOpenFile} takes accept as a list of extensions, such as ["jsonl"].`
    );
  }
  return { accept: accept.map(item => item.replace(/^\./, '')) };
}

/** `shell:reveal {path}`: an absolute path. */
export function readRevealPath(value: unknown): string {
  const path = text(record(value, IPC.shellReveal), 'path', IPC.shellReveal);
  if (!(path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path))) {
    throw new Error(
      `${IPC.shellReveal} takes an absolute path, not ${JSON.stringify(path)}.`
    );
  }
  return path;
}

/** `studio:app {uid}`: an application's uid. */
export function readStudioAppUid(value: unknown): string {
  const uid = text(record(value, IPC.studioApp), 'uid', IPC.studioApp);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new Error(
      `${IPC.studioApp} takes an application's uid, not ${JSON.stringify(uid)}.`
    );
  }
  return uid;
}

/** `studio:deployment-state {uid, version, state}`: one exact version, live or paused. */
export function readStudioStateChange(value: unknown): StudioStateChange {
  const channel = IPC.studioDeploymentState;
  const given = record(value, channel);
  const uid = text(given, 'uid', channel);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new Error(
      `${channel} takes a deployment's uid, not ${JSON.stringify(uid)}.`
    );
  }
  const version = given.version;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new Error(
      `${channel} changes one exact version, not ${JSON.stringify(version)}.`
    );
  }
  const state = given.state;
  if (state !== 'live' && state !== 'paused') {
    throw new Error(
      `${channel} sets a state of live or paused, not ${JSON.stringify(state)}.`
    );
  }
  return { uid, version, state };
}

/** `attention:front {uid}`: the session in front, or null for none. */
export function readFront(value: unknown): string | null {
  const given = record(value, IPC.attentionFront);
  if (given.uid === null || given.uid === undefined) {
    return null;
  }
  return text(given, 'uid', IPC.attentionFront);
}
