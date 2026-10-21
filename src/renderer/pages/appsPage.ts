/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Apps page's pure parts (DESKTOP DK-02): the applications listed
 * with what their deployments say, an application's Build (its Appspec's
 * facts and its YAML, written by agent-runtimes' `writeAppspecYaml`), Try
 * (the kept deployment the chat opens on, or why there is none), Activity
 * (its sessions from the Sessions page's list, with their lineage) and
 * Deployments (each one's state and the one change offered), with the
 * words the page says.
 *
 * @module renderer/pages/appsPage
 */

import { parseAppspec } from '@datalayer/agent-runtimes/lib/apps/apps/appspec';
import { writeAppspecYaml } from '@datalayer/agent-runtimes/lib/apps/apps/yaml';
import {
  sessionAgentSaid,
  sessionLineageSaid,
  sessionStateSaid,
} from '@datalayer/agent-runtimes/lib/portable/activity';
import {
  placeLabel,
  type PlaceGroup,
  type SessionEntry,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type { AppChatChoice, AppChatHandle } from '../../shared/appChat';
import type { ListedApp, AppDocument, AppDeployment } from '../../shared/apps';

import type { AppsSection } from './appsEvents';

export { APPS_SECTIONS, type AppsSection } from './appsEvents';

/** The words the page says, in one place. */
export const APPS_WORDS = {
  title: 'Your applications',
  refresh: 'Refresh',
  signedOut: 'Sign in to Datalayer to see your applications.',
  loading: 'Reading your applications…',
  none: 'You have no application yet: make one on datalayer.ai.',
  newOnWeb: 'New application on datalayer.ai',
  pickOne: 'Pick an application on the left.',
  pickOneSaid:
    'Build shows its Appspec, Try talks to it, Activity lists its sessions, Deployments pauses and resumes it.',
  openOnWeb: 'Open on datalayer.ai',
  sections: {
    build: 'Build',
    try: 'Try',
    activity: 'Activity',
    deployments: 'Deployments',
  } satisfies Record<AppsSection, string>,
  readingApp: 'Reading the application…',
  buildReadOnly:
    'Read here; edit, validate and ship it on datalayer.ai, where the editors of Apps are.',
  yamlTitle: 'Its Appspec',
  noSession: 'No session of this application yet.',
  openSession: 'Open in Sessions',
  noDeployment: 'This application is not deployed: ship it on datalayer.ai.',
  pause: 'Pause',
  resume: 'Resume',
  paused: (name: string, version: number) =>
    `${name} is paused (version ${version}).`,
  resumed: (name: string, version: number) =>
    `${name} answers again (version ${version}).`,
  notTalkable: 'None of this application’s deployments can be talked to here.',
  tryOnWeb: 'Try it on datalayer.ai',
} as const;

/** An application as the list draws it. */
export interface AppRow {
  app: ListedApp;
  /** What its deployments say: *Live · version 3*, *Paused*, *Not deployed*. */
  said: string;
}

/**
 * What an application's deployments say in a line.
 *
 * @param deployments - Its deployments.
 *
 * @returns The line.
 */
export function deploymentsSaid(deployments: readonly AppDeployment[]): string {
  if (deployments.length === 0) {
    return 'Not deployed';
  }
  const live = deployments.filter(one => one.state === 'live');
  if (live.length === 0) {
    return deployments.length === 1
      ? 'Paused'
      : `${deployments.length} deployments, all paused`;
  }
  const newest = Math.max(...live.map(one => one.version));
  const versions = newest > 0 ? ` · version ${newest}` : '';
  return live.length === 1
    ? `Live${versions}`
    : `${live.length} live${versions}`;
}

/**
 * The deployments of one application.
 *
 * @param deployments - The person's deployments.
 * @param appUid - The application.
 *
 * @returns Its deployments, in ai-agents' order.
 */
export function deploymentsOf(
  deployments: readonly AppDeployment[],
  appUid: string
): AppDeployment[] {
  return deployments.filter(one => one.appUid === appUid);
}

/**
 * The list's rows.
 *
 * @param apps - The applications, newest first.
 * @param deployments - The person's deployments, or null before they are read.
 *
 * @returns The rows, in the applications' order.
 */
export function appRowsOf(
  apps: readonly ListedApp[],
  deployments: readonly AppDeployment[] | null
): AppRow[] {
  return apps.map(app => ({
    app,
    said: deployments
      ? deploymentsSaid(deploymentsOf(deployments, app.uid))
      : '',
  }));
}

/** One fact of an Appspec, as Build lists it. */
export interface BuildFact {
  label: string;
  value: string;
}

/** What Build shows. */
export type BuildView =
  | { kind: 'spec'; facts: BuildFact[]; yaml: string; problems: string[] }
  | { kind: 'none'; sentence: string };

const listed = (values: readonly string[]): string =>
  values.filter(Boolean).join(', ');

/**
 * Build: the Appspec's facts and its YAML, as agent-runtimes reads and
 * writes it; or why there is none.
 *
 * @param document - The application read.
 *
 * @returns The view.
 */
export function buildViewOf(document: AppDocument): BuildView {
  if (!document.spec) {
    return { kind: 'none', sentence: document.problem };
  }
  const { app, problems } = parseAppspec(document.spec);
  const facts: BuildFact[] = [
    { label: 'Name', value: app.name || document.name },
    { label: 'Kind', value: app.kind },
    { label: 'Description', value: app.description },
    { label: 'Agent', value: app.team ? `team ${app.team}` : app.agent },
    { label: 'Model', value: app.model },
    { label: 'Skills', value: listed(app.skills) },
    {
      label: 'Connections',
      value: listed(app.connections.map(connection => connection.server)),
    },
    {
      label: 'Rules',
      value: app.rules.length
        ? `${app.rules.length} rule${app.rules.length === 1 ? '' : 's'}`
        : '',
    },
    {
      label: 'Revision',
      value: document.revision > 0 ? String(document.revision) : '',
    },
  ].filter(fact => fact.value);
  return { kind: 'spec', facts, yaml: writeAppspecYaml(app), problems };
}

/** What Try opens: the kept deployment's chat, or why not. */
export type TryDecision =
  | { kind: 'talk'; handle: AppChatHandle }
  | { kind: 'closed'; sentence: string };

/**
 * Try: the first deployment of the application that can be talked to (a
 * live one, kept always on, on a running runtime the app reaches), else
 * the sentences of those that cannot.
 *
 * @param appUid - The application.
 * @param choices - The choices `app-chat:list-deployments` answered.
 *
 * @returns The decision.
 */
export function tryDecisionOf(
  appUid: string,
  choices: readonly AppChatChoice[]
): TryDecision {
  const talk = choices.find(
    (choice): choice is Extract<AppChatChoice, { kind: 'talk' }> =>
      choice.kind === 'talk' && choice.handle.appUid === appUid
  );
  if (talk) {
    return { kind: 'talk', handle: talk.handle };
  }
  return { kind: 'closed', sentence: APPS_WORDS.notTalkable };
}

/**
 * The sentences of an application's deployments that cannot be talked to,
 * matched by uid against the person's deployments.
 *
 * @param choices - The choices.
 * @param deployments - The application's deployments.
 *
 * @returns The sentences.
 */
export function closedSentencesOf(
  choices: readonly AppChatChoice[],
  deployments: readonly AppDeployment[]
): string[] {
  const uids = new Set(deployments.map(one => one.uid));
  return choices.flatMap(choice =>
    choice.kind === 'closed' && uids.has(choice.uid) ? [choice.why] : []
  );
}

/** A session as Activity lists it. */
export interface ActivityRow {
  entry: SessionEntry;
  title: string;
  /** *Open · answering · coder · Datalayer*. */
  said: string;
  /** Where it comes from: *Cloned from … at turn 3*; empty for one opened here. */
  lineage: string;
}

/**
 * Activity: the application's sessions from the Sessions page's list
 * (both places), newest first, neither archived.
 *
 * @param places - What `sessions:list` answered.
 * @param appUid - The application.
 *
 * @returns The rows.
 */
export function activityRowsOf(
  places: readonly PlaceGroup[],
  appUid: string
): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const place of places) {
    for (const group of place.groups) {
      if (group.application.key !== appUid) {
        continue;
      }
      for (const entry of group.sessions) {
        if (entry.row.archived) {
          continue;
        }
        rows.push({
          entry,
          title: entry.row.title || entry.row.uid,
          said: [
            sessionStateSaid(entry.row),
            sessionAgentSaid(entry.row),
            entry.row.version > 0 ? `version ${entry.row.version}` : '',
            placeLabel(entry.place),
          ]
            .filter(Boolean)
            .join(' · '),
          lineage: sessionLineageSaid(entry.row),
        });
      }
    }
  }
  return rows.sort((a, b) =>
    b.entry.row.startedAt.localeCompare(a.entry.row.startedAt)
  );
}

/** A deployment as Deployments lists it. */
export interface DeploymentRow {
  deployment: AppDeployment;
  title: string;
  said: string;
  /** The change offered: pause a live one, resume a paused one; none without a version. */
  action: 'pause' | 'resume' | null;
}

/**
 * Deployments: each one's target, address, state and runtime, and the one
 * change offered.
 *
 * @param deployments - The application's deployments.
 *
 * @returns The rows.
 */
export function deploymentRowsOf(
  deployments: readonly AppDeployment[]
): DeploymentRow[] {
  return deployments.map(deployment => {
    const kept = deployment.alwaysOn
      ? deployment.keptState === 'running'
        ? 'kept always on, running'
        : `kept always on, ${deployment.keptState || 'not running'}${deployment.keptWhy ? `: ${deployment.keptWhy}` : ''}`
      : 'not kept always on';
    return {
      deployment,
      title: `${deployment.target}${deployment.slug ? ` · ${deployment.slug}` : ''}`,
      said: [
        deployment.state === 'live' ? 'Live' : 'Paused',
        deployment.version > 0
          ? `version ${deployment.version}`
          : 'no version said',
        kept,
      ].join(' · '),
      action:
        deployment.version > 0
          ? deployment.state === 'live'
            ? 'pause'
            : 'resume'
          : null,
    };
  });
}
