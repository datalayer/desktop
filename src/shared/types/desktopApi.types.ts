/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * What the preload exposes as `window.desktopAPI`: the sessions contract
 * (`ipc.types.ts`, DESKTOP §7) as the renderer calls it — each channel a
 * typed function, each event a subscription that returns its own removal.
 * The channels, their shapes and the readers at the boundary are the
 * contract's; this is the renderer's handle on them.
 *
 * @module types/desktopApi
 */

import type { HarnessFacts } from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import type {
  SessionFilter,
  SessionPlace,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type {
  ApprovalDecided,
  ApprovalDecision,
  FileOpened,
  FileSaved,
  FolderPicked,
  HarnessCheckResult,
  LocalRuntimeInfo,
  PendingApproval,
  RememberedFolders,
  SessionsListed,
  AppDocument,
  AppsListed,
  AppDeployment,
  DeploymentStateChange,
} from './ipc.types';

/** A subscription's removal. */
export type Unsubscribe = () => void;

export interface DesktopAPI {
  sessions: {
    /** `sessions:list {filter?}`: the two places merged. */
    list: (filter?: SessionFilter) => Promise<SessionsListed>;
    /** `sessions:changed`: something changed that the list should show again. */
    onChanged: (callback: () => void) => Unsubscribe;
  };
  localRuntime: {
    /** `local-runtime:start {folder}`: the folder's runtime, started when it is not running. */
    start: (folder: string) => Promise<LocalRuntimeInfo>;
    /** `local-runtime:stop {folder?}`: that folder's runtime, or every runtime. */
    stop: (folder?: string) => Promise<void>;
    /** `local-runtime:list`: the runtimes running now. */
    list: () => Promise<LocalRuntimeInfo[]>;
    /** `local-runtime:folders`: the last ten folders worked in, the last one first. */
    folders: () => Promise<RememberedFolders>;
    /** `local-runtime:harnesses {folder?}`: the catalogue from a running runtime. */
    harnesses: (folder?: string) => Promise<HarnessFacts[]>;
    /** `local-runtime:check-harness {harness}`: what the machine has for it (DK-06). */
    checkHarness: (harness: string) => Promise<HarnessCheckResult>;
    /** `local-runtime:changed`: a local runtime started or stopped. */
    onChanged: (callback: () => void) => Unsubscribe;
  };
  credentials: {
    /** `credentials:set {name, value}`: kept in the app's keychain; an empty value forgets it. */
    set: (name: string, value: string) => Promise<void>;
    /** `credentials:has {name}`: whether the keychain holds it, never the value. */
    has: (name: string) => Promise<boolean>;
  };
  approvals: {
    /** `approvals:pending`: what waits for the person, both places. */
    pending: () => Promise<PendingApproval[]>;
    /** `approvals:decide`: the decision sent to the place's one way. */
    decide: (decision: ApprovalDecision) => Promise<ApprovalDecided>;
    /** `approvals:changed`: the pending list changed; the payload is the new list. */
    onChanged: (callback: (pending: PendingApproval[]) => void) => Unsubscribe;
  };
  dialog: {
    /** `dialog:open-folder`: the OS folder picker; null when declined. */
    openFolder: () => Promise<FolderPicked | null>;
    /** `dialog:save {name, text}`: the OS save dialog, the text written; null when declined. */
    save: (name: string, text: string) => Promise<FileSaved | null>;
    /** `dialog:open-file {accept}`: the OS open dialog, the file read as text; null when declined. */
    openFile: (accept: string[]) => Promise<FileOpened | null>;
  };
  shell: {
    /** `shell:reveal {path}`: the file or folder shown in the OS's file browser. */
    reveal: (path: string) => Promise<void>;
  };
  apps: {
    /** `apps:list`: the person's applications, newest first, and the landing's origin. */
    list: () => Promise<AppsListed>;
    /** `apps:app {uid}`: one application's Appspec, or why it has none. */
    app: (uid: string) => Promise<AppDocument>;
    /** `apps:deployments`: the person's deployments at ai-agents. */
    deployments: () => Promise<AppDeployment[]>;
    /** `apps:deployment-state`: a deployment paused or resumed, for one exact version. */
    setDeploymentState: (
      change: DeploymentStateChange
    ) => Promise<AppDeployment>;
  };
  attention: {
    /** `attention:front {uid}`: the session the chat shows now, or null — never notified. */
    front: (uid: string | null) => Promise<void>;
    /** `attention:focus {uid}`: a notification or the tray was clicked; the page opens that session. */
    onFocus: (callback: (uid: string) => void) => Unsubscribe;
  };
}

/** The place a session's approvals and verbs name: re-exported for the renderer. */
export type { SessionPlace };
