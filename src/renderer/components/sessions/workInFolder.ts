/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Work in a folder (DESKTOP DK-07), the pure parts: the harnesses as the
 * picker lists them with their terms; the applications offered — the blank
 * harness application (the harness as the application's agent, reading and
 * editing in the folder done, deleting and running a command asked first,
 * every action in the record), then the folder's own Appspecs; the body of
 * `POST /api/v1/apps/configure`; the agent the runtime made; the session
 * the start stream names (`loop.session`); a refusal as the runtime said
 * it; the chat's protocol on a local runtime — the session API's AG-UI
 * route of the agent, each thread a session, with its ui channel and its
 * sessions route, nothing signed (the runtime is this machine's own).
 *
 * Pure: no React, no `window`, no network.
 *
 * @module renderer/components/sessions/workInFolder
 */

import type { AgUiEvent } from '@datalayer/agent-runtimes/lib/portable/agui';
import type { HarnessFacts } from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import type { ProtocolConfig } from '@datalayer/agent-runtimes/lib/types/protocol';

/** What the pickers say. */
export const WORK_IN_FOLDER_WORDS = {
  title: 'Work in a folder',
  pickFolder: 'Pick the folder a coding agent works in.',
  chooseAnother: 'Choose another folder…',
  recent: 'Recent folders',
  noRecent: 'No folder yet: choose one.',
  pickHarness: 'Pick the coding agent (the harness) that works in it.',
  noHarness:
    "The local runtime lists no harness: install agent-runtimes with the shield extra (`uv tool install 'agent-runtimes[shield]'`).",
  checking: 'Checking this machine for it…',
  setup: (line: string): string => `Run ${line} to install what is missing.`,
  credentialAsked: (name: string): string =>
    `${name} is not in your environment: type it once; it is kept in the app’s keychain and never shown or logged.`,
  credentialKept: (name: string): string =>
    `${name} is kept in the app’s keychain.`,
  setupLine: 'What is missing is installed by this command, run in a terminal:',
  checkAgain: 'Check again',
  pickApplication: 'Pick the application the agent runs as.',
  blank: (harness: string): string => `${harness} in this folder`,
  blankDetail:
    'The blank harness application: reading and editing done; deleting and running a command asked first; every action in the record.',
  starting: 'Starting the local runtime…',
  configuring: 'Configuring the application on the folder’s runtime…',
  opening: 'Opening the session…',
  start: 'Start',
  next: 'Next',
  back: 'Back',
  cancel: 'Cancel',
} as const;

/** The Appspec schema an application declares. */
export const APPSPEC_SCHEMA = 'loop.app/v1';

/** The id prefix of the blank harness application. */
export const BLANK_APP_PREFIX = 'desktop-';

/** A harness as the picker offers it: the name, the credential it takes, its terms. */
export interface HarnessChoice {
  id: string;
  label: string;
  /** *takes ANTHROPIC_API_KEY*, or `''`. */
  description: string;
  /** Its terms: serving others, tier restrictions, the licence, the adapter. */
  detail: string;
}

/** The harnesses as the picker lists them, in the catalogue's order. */
export function harnessChoices(
  harnesses: readonly HarnessFacts[]
): HarnessChoice[] {
  return harnesses.map(harness => ({
    id: harness.id,
    label: harness.name,
    description: harness.credential ? `takes ${harness.credential}` : '',
    detail:
      `Serving others: ${harness.servedToThirdParties.replace(/_/g, ' ')}` +
      (harness.tierRestrictions ? ` — ${harness.tierRestrictions}` : '') +
      (harness.licence ? ` · ${harness.licence}` : '') +
      (harness.adapter
        ? ` · adapter ${harness.adapter} ${harness.adapterVersion}`.trimEnd()
        : ''),
  }));
}

/**
 * The blank harness application: the harness as the application's agent,
 * reading and editing in the folder done, deleting and running a command
 * asked first, the notebook in front passed when it asks (`host_context`),
 * every action in the record.
 */
export function blankHarnessApp(
  harness: { id: string; name: string },
  folderName: string
): Record<string, unknown> {
  return {
    schema: APPSPEC_SCHEMA,
    id: `${BLANK_APP_PREFIX}${harness.id}`,
    version: '0.0.1',
    name: `${harness.name} in ${folderName}`,
    kind: 'chat',
    description: `${harness.name} working in the folder ${folderName}, behind the Shield.`,
    agent: `example-harness-${harness.id}`,
    instructions:
      'You work in the open folder only. Do what is asked, in as few steps as possible, then stop with one short sentence.',
    rules: [
      { action: 'Read files', applies_to: 'read', behaviour: 'do_it' },
      { action: 'Edit files', applies_to: 'write', behaviour: 'do_it' },
      {
        action: 'Delete files',
        applies_to: 'delete',
        behaviour: 'ask_me_first',
      },
      {
        action: 'Run a command',
        applies_to: 'execute',
        behaviour: 'ask_me_first',
      },
      {
        action: 'Read the notebook in front',
        applies_to: 'host_context',
        behaviour: 'do_it',
      },
    ],
    record: {
      keep_for: '30_days',
      include: [
        'conversations',
        'actions',
        'decisions',
        'approvals',
        'diffs',
        'terminals',
      ],
    },
    deployment: { embedded: { host: { context: ['page'] } } },
    interface: {
      layout: 'chat',
      welcome: `Ask ${harness.name} to read, write or run something in ${folderName}.`,
    },
    tags: ['harness', 'desktop'],
  };
}

/** An Appspec of the folder, as the main process read it. */
export interface FolderAppspec {
  /** Its path, relative to the folder. */
  path: string;
  /** The Appspec, parsed. */
  spec: Record<string, unknown>;
}

/** An application as the picker offers it. */
export interface AppChoice {
  label: string;
  description: string;
  detail: string;
  /** The Appspec to configure. */
  spec: Record<string, unknown>;
  /** Its file, relative to the folder; `''` for the blank one. */
  path: string;
}

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** The applications offered: the blank harness application first, then the folder's own. */
export function appChoices(
  harness: { id: string; name: string },
  folderName: string,
  own: readonly FolderAppspec[]
): AppChoice[] {
  const choices: AppChoice[] = [
    {
      label: WORK_IN_FOLDER_WORDS.blank(harness.name),
      description: 'the blank harness application',
      detail: WORK_IN_FOLDER_WORDS.blankDetail,
      spec: blankHarnessApp(harness, folderName),
      path: '',
    },
  ];
  for (const file of own) {
    choices.push({
      label: text(file.spec.name) || text(file.spec.id) || file.path,
      description: file.path,
      detail: text(file.spec.description),
      spec: file.spec,
      path: file.path,
    });
  }
  return choices;
}

/** The body of `POST /api/v1/apps/configure`. */
export function configureBody(spec: Record<string, unknown>): {
  app: Record<string, unknown>;
} {
  return { app: spec };
}

/** The agent the runtime made for the application, from `configure`'s answer. */
export function agentIdOf(answer: unknown): string {
  const body =
    answer && typeof answer === 'object'
      ? (answer as Record<string, unknown>)
      : {};
  return text(body.agent_id) || text(body.id) || 'default';
}

/**
 * The session a start stream names: the `loop.session` event's `uid`.
 *
 * @throws Error when no event names one: the runtime opened no session.
 */
export function sessionUidOfEvents(events: readonly AgUiEvent[]): string {
  for (const event of events) {
    if (event.type === 'CUSTOM' && event.name === 'loop.session') {
      const value =
        event.value && typeof event.value === 'object'
          ? (event.value as Record<string, unknown>)
          : {};
      const uid = text(value.uid);
      if (uid) {
        return uid;
      }
    }
  }
  throw new Error(
    'The local runtime opened no session: its answer names no session uid.'
  );
}

/**
 * A refusal as the runtime said it: its `detail`, or its `problems` joined,
 * else the text; never reworded.
 */
export function runtimeRefusal(
  what: string,
  status: number,
  body: string
): string {
  let said = body.trim();
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    const detail = parsed.detail;
    if (typeof detail === 'string') {
      said = detail;
    } else if (detail && typeof detail === 'object') {
      const problems = (detail as { problems?: unknown }).problems;
      if (Array.isArray(problems) && problems.length > 0) {
        said = problems.map(problem => text(problem)).join(' ');
      }
    }
  } catch {
    // Not JSON: the text as it is.
  }
  return `${what} was refused by the local runtime (${status})${said ? `: ${said}` : '.'}`;
}

/**
 * The chat's protocol on a local runtime: the session API's AG-UI route of
 * the agent, each thread a session, with its ui channel and its sessions
 * route, so a session opened by uid is the conversation and its menu's
 * entries act on it. Nothing is signed.
 */
export function localSessionProtocol(
  runtimeUrl: string,
  agentId: string
): ProtocolConfig {
  const base = runtimeUrl.replace(/\/+$/, '');
  const agent = encodeURIComponent(agentId);
  return {
    type: 'ag-ui',
    endpoint: `${base}/api/v1/apps/agents/${agent}/ag-ui/`,
    agentId,
    configEndpoint: `${base}/api/v1/configure`,
    enableConfigQuery: true,
    uiSocket: `${base.replace(/^http/, 'ws')}/api/v1/apps/ui`,
    uiFiles: `${base}/api/v1/apps/agents/${agent}/files`,
    appSessions: `${base}/api/v1/apps/sessions`,
  } as ProtocolConfig;
}
