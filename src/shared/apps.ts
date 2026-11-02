/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Apps, native (DESKTOP DK-02): what the main process reads for the
 * *Apps* tab and hands the renderer — the person's applications (their
 * Spacer items of type `app`), one application's Appspec (its item's
 * `loop.app.item/v1` model), the person's deployments at ai-agents — and
 * the one change the tab makes, a deployment paused or resumed for one
 * exact version (agent-runtimes' `stateChangeBody`).
 *
 * The routes are the platform's own: Spacer's
 * `GET /api/spacer/v1/spaces/items/types/app` and
 * `GET /api/spacer/v1/lexicals/{uid}`, ai-agents'
 * `GET /api/ai-agents/v1/apps/deployments` and
 * `PATCH /api/ai-agents/v1/apps/deployments/{uid}`. What the tab does not
 * offer is opened on the web (`appsWebUrl`): the landing origin is
 * `DATALAYER_LANDING_URL` when it is a web origin, else the development
 * server in development, else `https://datalayer.ai`.
 *
 * Pure: no Electron, no React, no network. Read by the main process
 * (`main/services/apps.ts`) and the renderer (`pages/appsPage.ts`).
 *
 * @module shared/apps
 */

import {
  type DeploymentState,
  stateChangeBody,
} from '@datalayer/agent-runtimes/lib/portable/lifecycle';
import { APP_ITEM_FORMAT } from './appChat';

/** The landing in production; the development server otherwise. */
export const LANDING_ORIGINS = {
  production: 'https://datalayer.ai',
  development: 'http://localhost:3063',
} as const;

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const base = (url: string): string => url.replace(/\/+$/, '');

/**
 * An HTTP(S) origin, or `""` for anything else (a path, credentials, a
 * scheme that is not the web's).
 *
 * @param url - A configured URL.
 *
 * @returns Its origin.
 */
export function webOrigin(url: string | undefined): string {
  try {
    const parsed = new URL(url || '');
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
}

/**
 * The landing's origin, where what the tab does not offer is opened.
 *
 * @param env - The environment.
 * @param development - Whether the app runs in development.
 *
 * @returns The origin, without a trailing slash.
 */
export function landingOrigin(
  env: Record<string, string | undefined>,
  development: boolean
): string {
  return (
    webOrigin(env.DATALAYER_LANDING_URL) ||
    (development ? LANDING_ORIGINS.development : LANDING_ORIGINS.production)
  );
}

/** The web Apps' tabs an application is opened on. */
export type AppsWebTab =
  'build' | 'try' | 'validate' | 'ship' | 'activity' | 'settings';

/**
 * The web Apps' page: its Home, or an application on one of its tabs.
 *
 * @param origin - The landing's origin.
 * @param appUid - The application, or none for the Home.
 * @param tab - The tab, for an application.
 *
 * @returns The URL.
 */
export function appsWebUrl(
  origin: string,
  appUid?: string,
  tab?: AppsWebTab
): string {
  const at = base(origin);
  if (!appUid) {
    return `${at}/studio`;
  }
  const page = `${at}/studio/apps/${encodeURIComponent(appUid)}`;
  return tab ? `${page}?tab=${tab}` : page;
}

// --- the applications -------------------------------------------------------

/** One of the person's applications, as Spacer lists it. */
export interface ListedApp {
  uid: string;
  name: string;
  description: string;
  /** When it was last saved (ISO), else when it was made; may be empty. */
  updatedAt: string;
}

/** Where Spacer lists the person's applications. */
export function spacerAppsUrl(spacerUrl: string): string {
  return `${base(spacerUrl)}/api/spacer/v1/spaces/items/types/app`;
}

/** Where Spacer answers one application's item. */
export function spacerAppUrl(spacerUrl: string, uid: string): string {
  return `${base(spacerUrl)}/api/spacer/v1/lexicals/${encodeURIComponent(uid)}`;
}

/**
 * An application as Spacer lists it (`uid`, `name_t`, `description_t`,
 * `last_update_ts_dt`), or `undefined` for an item without a uid.
 *
 * @param raw - One listed item.
 *
 * @returns The application.
 */
export function listedAppOf(raw: unknown): ListedApp | undefined {
  const item = record(raw);
  const uid = text(item.uid) || text(item.id);
  if (!uid) {
    return undefined;
  }
  return {
    uid,
    name: text(item.name_t) || text(item.name) || 'Untitled application',
    description: text(item.description_t) || text(item.description),
    updatedAt: text(item.last_update_ts_dt) || text(item.creation_ts_dt),
  };
}

/**
 * The person's applications, newest first.
 *
 * @param body - Spacer's answer (`{items}`).
 *
 * @returns The applications.
 *
 * @throws When the answer lists no items.
 */
export function listedAppsOf(body: unknown): ListedApp[] {
  const items = record(body).items;
  if (!Array.isArray(items)) {
    throw new Error('Spacer answered no list of applications.');
  }
  return items
    .map(listedAppOf)
    .filter((app): app is ListedApp => app !== undefined)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** One application read: its Appspec, as its item holds it. */
export interface AppDocument {
  uid: string;
  name: string;
  description: string;
  /** The saved revision, 0 when none is said. */
  revision: number;
  /** The Appspec in the spec's own words; null when the item holds none. */
  spec: Record<string, unknown> | null;
  /** Why there is no Appspec, in a sentence; empty when there is one. */
  problem: string;
}

/** The sentence when an item holds no Appspec. */
export const NO_APPSPEC =
  'This application holds no Appspec that can be read: open it on datalayer.ai and save it.';

/**
 * One application from its Spacer item (`{document: {model_s, …}}`).
 *
 * @param body - Spacer's answer.
 * @param uid - The application asked for.
 *
 * @returns The application, its Appspec or why there is none.
 *
 * @throws When the item is not an application.
 */
export function appDocumentOf(body: unknown, uid: string): AppDocument {
  const document = record(record(body).document);
  if (text(document.type_s) && text(document.type_s) !== 'app') {
    throw new Error(`${uid} is not an application.`);
  }
  let stored: Record<string, unknown> = {};
  try {
    stored = record(JSON.parse(text(document.model_s) || 'null'));
  } catch {
    stored = {};
  }
  const spec = record(stored.spec);
  const readable = stored.format === APP_ITEM_FORMAT && Boolean(spec.schema);
  const revision = Number(record(stored.state).revision);
  return {
    uid,
    name:
      (readable ? text(spec.name) : '') ||
      text(document.name_t) ||
      'Untitled application',
    description:
      (readable ? text(spec.description) : '') || text(document.description_t),
    revision: Number.isFinite(revision) ? Math.trunc(revision) : 0,
    spec: readable ? spec : null,
    problem: readable ? '' : NO_APPSPEC,
  };
}

// --- the deployments ------------------------------------------------------

/** A deployment as the tab lists it. */
export interface AppDeployment {
  uid: string;
  appUid: string;
  appName: string;
  version: number;
  /** `hosted`, `embedded` or `preview`. */
  target: string;
  state: DeploymentState;
  slug: string;
  alwaysOn: boolean;
  /** The kept runtime's state (`running`, …), empty when none is kept. */
  keptState: string;
  /** Why the kept runtime is not running, as ai-agents says it. */
  keptWhy: string;
  updatedAt: string;
}

/**
 * A deployment as ai-agents answers it, or `undefined` without a uid.
 *
 * @param raw - One listed deployment.
 *
 * @returns The deployment.
 */
export function appDeploymentOf(raw: unknown): AppDeployment | undefined {
  const deployment = record(raw);
  const uid = text(deployment.uid);
  if (!uid) {
    return undefined;
  }
  const version = Number(deployment.version);
  const kept = record(deployment.kept);
  return {
    uid,
    appUid: text(deployment.app_uid),
    appName: text(deployment.app_name) || 'This application',
    version: Number.isInteger(version) && version > 0 ? version : 0,
    target: text(deployment.target) || 'hosted',
    state: deployment.state === 'paused' ? 'paused' : 'live',
    slug: text(deployment.slug),
    alwaysOn: deployment.always_on === true,
    keptState: text(kept.state),
    keptWhy: text(kept.why),
    updatedAt: text(deployment.updated_at),
  };
}

/**
 * The person's deployments (`{deployments}`).
 *
 * @param body - ai-agents' answer.
 *
 * @returns The deployments, in ai-agents' order.
 *
 * @throws When the answer lists no deployments.
 */
export function appDeploymentsOf(body: unknown): AppDeployment[] {
  const listed = record(body).deployments;
  if (!Array.isArray(listed)) {
    throw new Error('ai-agents answered no list of deployments.');
  }
  return listed
    .map(appDeploymentOf)
    .filter((one): one is AppDeployment => one !== undefined);
}

/** A deployment paused or resumed, for one exact version. */
export interface DeploymentStateChange {
  uid: string;
  version: number;
  state: DeploymentState;
}

/**
 * The change the deployment's button makes: a live one paused, a paused one
 * resumed, for the version it runs.
 *
 * @param deployment - The deployment.
 *
 * @returns The change.
 *
 * @throws When the deployment does not say its version.
 */
export function toggledStateOf(
  deployment: Pick<AppDeployment, 'uid' | 'version' | 'state'>
): DeploymentStateChange {
  const state: DeploymentState =
    deployment.state === 'live' ? 'paused' : 'live';
  return {
    uid: deployment.uid,
    ...stateChangeBody(deployment.version, state),
  };
}

/** Where a deployment's state is changed. */
export function deploymentUrl(aiAgentsUrl: string, uid: string): string {
  return `${base(aiAgentsUrl)}/api/ai-agents/v1/apps/deployments/${encodeURIComponent(uid)}`;
}

/** What the main process answers for the applications: them, and where Apps on the web is. */
export interface AppsListed {
  apps: ListedApp[];
  /** The landing's origin, for what the tab opens on the web. */
  landing: string;
}
