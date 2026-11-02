/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Waiting for you, the two sources (DESKTOP DK-13), the main process's: an
 * *ask me first* decision is decided through the place's one way —
 *
 * - **on this machine, over the local runtime's websocket**
 *   (`/api/v1/tool-approvals/ws`): one socket per running runtime,
 *   `agent.snapshot` messages list what is pending, a
 *   `tool_approval_decision` message decides, the next snapshot confirms
 *   (VS-07 as built; the runtime has no `/approve|reject` route);
 * - **on Datalayer**, ai-agents' `/tool-approvals/{id}/approve|reject`,
 *   polled every 3 s while signed in (as A-20 polls), the approval read
 *   again before deciding, a 409 said (*answered elsewhere*), a 404
 *   revealing nothing (the phone's rules).
 *
 * The sources are here and not in the renderer so that the OS can tell the
 * person with the chat closed (DK-14); the renderer gets the pending list
 * over `approvals:pending` and `approvals:changed`, and sends decisions
 * over `approvals:decide`. The pure parts — the snapshot read, the
 * decision's shape, what it came to — are agent-runtimes'
 * `portable/localApprovals.ts` and `portable/attention.ts` (DK-25).
 *
 * @module main/services/approvals
 */

import log from 'electron-log/main';
import WebSocket from 'ws';
import { DEFAULT_PLANE_URLS } from '@datalayer/core/lib/config/planes';
import { actionOf } from '@datalayer/agent-runtimes/lib/portable/approvalCard';
import {
  type ApprovalRaised,
  decisionOutcome,
  stillPending,
} from '@datalayer/agent-runtimes/lib/portable/attention';
import {
  approvalsOfSnapshot,
  decisionMessage,
  decisionSettled,
  isSnapshot,
  LOCAL_AGENT_ID,
  LOCAL_APPROVAL_WORDS,
  localApprovalsSocketUrl,
} from '@datalayer/agent-runtimes/lib/portable/localApprovals';
import type { SessionPlace } from '@datalayer/agent-runtimes/lib/portable/sessionList';
import { decideApprovalUrl, pendingApprovalsOf } from '../../shared/appChat';
import type {
  ApprovalDecided,
  ApprovalDecision,
  LocalRuntimeInfo,
  PendingApproval,
} from '../../shared/types/ipc.types';
import { localRuntimes } from './local-runtime';
import { sdkBridge } from './datalayer-sdk-bridge';

/** How long a local decision waits for the snapshot confirming it. */
const DECISION_TIMEOUT_MS = 10_000;

/** How long before a socket that closed is opened again. */
const RETRY_MS = 3_000;

/** How often ai-agents is asked while signed in. */
export const DATALAYER_POLL_MS = 3_000;

/** What the sources read from, so the tests give their own. */
export interface ApprovalsDeps {
  runtimes: () => LocalRuntimeInfo[];
  /** Fires when a runtime starts or stops. */
  onRuntimesChange: (listener: () => void) => () => void;
  /** The token and ai-agents' base URL when signed in; null otherwise. */
  signedIn: () => { token: string; aiAgentsUrl: string } | null;
  fetch: typeof fetch;
  /** A websocket to a local runtime. */
  socket: (url: string) => WebSocket;
  log: (line: string) => void;
  /** The poll's period; the tests shorten it. */
  pollMs?: number;
}

/** The sources: pending, decide, watch. */
export interface Approvals {
  /** Opens the sockets and the poll. */
  start(): void;
  /** Closes everything. */
  stop(): void;
  /** What waits for the person now, both places. */
  pending(): PendingApproval[];
  /** Decides one through its place's one way; the sentence says what it came to. */
  decide(decision: ApprovalDecision): Promise<ApprovalDecided>;
  /** Fires with the pending list whenever it changes. */
  onChange(listener: (pending: PendingApproval[]) => void): () => void;
}

/** A local decision waiting for the snapshot that confirms it. */
interface Waiter {
  id: string;
  approved: boolean;
  action: string;
  resolve: (said: string) => void;
  timer: NodeJS.Timeout;
}

interface Entry {
  runtime: LocalRuntimeInfo;
  socket: WebSocket;
  pending: ApprovalRaised[];
  waiters: Waiter[];
  retry: NodeJS.Timeout | null;
  closed: boolean;
}

const sameList = (
  a: readonly PendingApproval[],
  b: readonly PendingApproval[]
): boolean =>
  a.length === b.length &&
  a.every(
    (item, index) =>
      item.id === b[index]?.id && item.place.kind === b[index]?.place.kind
  );

/**
 * The sources over their dependencies.
 *
 * @param deps - The runtimes, the sign-in, `fetch`, the sockets.
 *
 * @returns The sources.
 */
export function createApprovals(deps: ApprovalsDeps): Approvals {
  const entries = new Map<string, Entry>();
  const listeners = new Set<(pending: PendingApproval[]) => void>();
  let datalayerPending: PendingApproval[] = [];
  let poll: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;
  let lastSaid: PendingApproval[] = [];

  const localPlaceOf = (runtime: LocalRuntimeInfo): SessionPlace => ({
    kind: 'local',
    folder: runtime.folder,
    folderName: runtime.folderName,
    url: runtime.url,
  });

  const pending = (): PendingApproval[] => [
    ...datalayerPending,
    ...[...entries.values()].flatMap(entry =>
      entry.pending.map(approval => ({
        place: localPlaceOf(entry.runtime),
        id: approval.id,
        toolName: approval.toolName,
        args: approval.args,
        agentId: approval.agentId,
        requestedAt: approval.requestedAt,
        app: `The coding agent in ${entry.runtime.folderName}`,
      }))
    ),
  ];

  const changed = (): void => {
    const now = pending();
    if (sameList(now, lastSaid)) {
      return;
    }
    lastSaid = now;
    for (const listener of listeners) {
      try {
        listener(now);
      } catch (error) {
        deps.log(
          `A listener failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  };

  // -- This machine: the websockets ----------------------------------------

  const snapshot = (entry: Entry, message: unknown): void => {
    entry.pending = approvalsOfSnapshot(message, LOCAL_AGENT_ID);
    for (const waiter of entry.waiters.splice(0)) {
      const said = decisionSettled(
        true,
        entry.pending,
        waiter.id,
        waiter.approved,
        waiter.action
      );
      if (said === null) {
        entry.waiters.push(waiter);
      } else {
        clearTimeout(waiter.timer);
        waiter.resolve(said);
      }
    }
    changed();
  };

  const forget = (key: string): void => {
    const entry = entries.get(key);
    if (!entry) {
      return;
    }
    entries.delete(key);
    entry.closed = true;
    if (entry.retry) {
      clearTimeout(entry.retry);
    }
    for (const waiter of entry.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve(LOCAL_APPROVAL_WORDS.socketGone(entry.runtime.folderName));
    }
    try {
      entry.socket.close();
    } catch {
      // Already gone.
    }
    changed();
  };

  const open = (runtime: LocalRuntimeInfo): void => {
    const key = runtime.url;
    const socket = deps.socket(
      localApprovalsSocketUrl(runtime.url, LOCAL_AGENT_ID)
    );
    const entry: Entry = {
      runtime,
      socket,
      pending: [],
      waiters: [],
      retry: null,
      closed: false,
    };
    entries.set(key, entry);
    socket.on('message', raw => {
      let message: unknown;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (isSnapshot(message)) {
        snapshot(entry, message);
      }
    });
    socket.on('error', error => {
      deps.log(
        `The approvals socket of ${runtime.folderName} failed: ${error.message}`
      );
    });
    socket.on('close', () => {
      for (const waiter of entry.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.resolve(LOCAL_APPROVAL_WORDS.socketGone(runtime.folderName));
      }
      if (entry.closed || entries.get(key) !== entry) {
        return;
      }
      // The runtime still runs: opened again after a while.
      entry.retry = setTimeout(() => {
        if (entries.get(key) === entry) {
          entries.delete(key);
          sync();
        }
      }, RETRY_MS);
    });
  };

  /** The sockets follow the runtimes: one opened per runtime, closed with it. */
  const sync = (): void => {
    const running = new Map(
      deps.runtimes().map(runtime => [runtime.url, runtime])
    );
    for (const key of [...entries.keys()]) {
      if (!running.has(key)) {
        forget(key);
      }
    }
    for (const [key, runtime] of running) {
      if (!entries.has(key)) {
        open(runtime);
      }
    }
  };

  const decideLocal = (
    url: string,
    id: string,
    approved: boolean,
    note?: string
  ): Promise<string> => {
    const entry = entries.get(url);
    if (!entry || entry.socket.readyState !== WebSocket.OPEN) {
      return Promise.resolve(
        LOCAL_APPROVAL_WORDS.socketGone(entry?.runtime.folderName ?? url)
      );
    }
    const known = entry.pending.find(approval => approval.id === id);
    const action = actionOf(known?.toolName ?? '');
    if (!known) {
      return Promise.resolve(
        decisionSettled(false, entry.pending, id, approved, action) ?? ''
      );
    }
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        entry.waiters = entry.waiters.filter(waiter => waiter.timer !== timer);
        resolve(LOCAL_APPROVAL_WORDS.notConfirmed);
      }, DECISION_TIMEOUT_MS);
      entry.waiters.push({ id, approved, action, resolve, timer });
      deps.log(
        `Local decision sent: ${id} ${approved ? 'approved' : 'declined'}.`
      );
      entry.socket.send(decisionMessage(id, approved, note));
    });
  };

  // -- Datalayer: ai-agents polled -----------------------------------------

  const readDatalayer = async (): Promise<void> => {
    const signedIn = deps.signedIn();
    if (!signedIn) {
      if (datalayerPending.length > 0) {
        datalayerPending = [];
        changed();
      }
      return;
    }
    try {
      const response = await deps.fetch(
        `${signedIn.aiAgentsUrl.replace(/\/$/, '')}/api/ai-agents/v1/tool-approvals?status=pending&limit=200`,
        { headers: { Authorization: `Bearer ${signedIn.token}` } }
      );
      if (!response.ok) {
        deps.log(
          `ai-agents answered ${response.status} for the pending approvals.`
        );
        return;
      }
      const body = (await response.json()) as { approvals?: unknown[] };
      const listed = Array.isArray(body.approvals) ? body.approvals : [];
      const agents = new Set(
        listed.map(raw =>
          raw &&
          typeof raw === 'object' &&
          typeof (raw as { agent_id?: unknown }).agent_id === 'string'
            ? (raw as { agent_id: string }).agent_id
            : ''
        )
      );
      datalayerPending = [...agents].filter(Boolean).flatMap(agentId =>
        pendingApprovalsOf(body, agentId).map(approval => ({
          place: { kind: 'datalayer' } as SessionPlace,
          id: approval.id,
          toolName: approval.toolName,
          args: approval.args,
          agentId,
          requestedAt: approval.requestedAt,
          app: agentId,
        }))
      );
      changed();
    } catch (error) {
      deps.log(
        `The pending approvals could not be read: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const decideDatalayer = async (
    id: string,
    approved: boolean,
    note?: string
  ): Promise<string> => {
    const signedIn = deps.signedIn();
    if (!signedIn) {
      return 'Sign in to Datalayer to decide this approval.';
    }
    const headers = {
      Authorization: `Bearer ${signedIn.token}`,
      'Content-Type': 'application/json',
    };
    const base = signedIn.aiAgentsUrl.replace(/\/$/, '');
    const known = datalayerPending.find(approval => approval.id === id);
    const action = actionOf(known?.toolName ?? '');
    // Read again before deciding: one answered elsewhere is said so, one gone reveals nothing.
    const again = await deps.fetch(
      `${base}/api/ai-agents/v1/tool-approvals/${encodeURIComponent(id)}`,
      { headers }
    );
    if (again.status === 404) {
      return decisionOutcome(404, approved, action);
    }
    const read = again.ok
      ? ((await again.json()) as {
          approval?: { status?: unknown };
          status?: unknown;
        })
      : null;
    if (!stillPending(read?.approval ?? read)) {
      return decisionOutcome(409, approved, action);
    }
    const decided = await deps.fetch(
      decideApprovalUrl(signedIn.aiAgentsUrl, id, approved),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(note ? { note } : {}),
      }
    );
    const said = decisionOutcome(decided.status, approved, action);
    void readDatalayer();
    return said;
  };

  return {
    start() {
      if (unsubscribe) {
        return;
      }
      unsubscribe = deps.onRuntimesChange(sync);
      sync();
      void readDatalayer();
      poll = setInterval(
        () => void readDatalayer(),
        deps.pollMs ?? DATALAYER_POLL_MS
      );
    },
    stop() {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
      unsubscribe?.();
      unsubscribe = null;
      for (const key of [...entries.keys()]) {
        forget(key);
      }
      datalayerPending = [];
    },
    pending,
    async decide(decision) {
      const approved = decision.decision === 'approve';
      if (decision.place.kind === 'local') {
        return {
          said: await decideLocal(
            decision.place.url,
            decision.id,
            approved,
            decision.note
          ),
        };
      }
      return {
        said: await decideDatalayer(decision.id, approved, decision.note),
      };
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The app's sources: the local runtimes, the SDK bridge's sign-in, `ws`. */
export const approvals: Approvals = createApprovals({
  runtimes: () => localRuntimes.infos(),
  onRuntimesChange: listener => localRuntimes.onChange(listener),
  signedIn: () => {
    const config = sdkBridge.getConfig();
    return sdkBridge.isAuthenticated() && config.token
      ? {
          token: config.token,
          aiAgentsUrl:
            process.env.DATALAYER_AI_AGENTS_URL ||
            DEFAULT_PLANE_URLS.aiAgentsUrl,
        }
      : null;
  },
  fetch: (input, init) => fetch(input, init),
  socket: url => new WebSocket(url),
  log: line => log.info(`[Approvals] ${line}`),
});
