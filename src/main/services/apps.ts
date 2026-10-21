/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Apps, native — the main process's side (DESKTOP DK-02). The
 * *Apps* tab is the app's own React page; what it reads of Datalayer is
 * read here, with the token this process holds, and handed over IPC as the
 * Sessions page's lists are: the person's applications (Spacer), one
 * application's Appspec (its Spacer item), the person's deployments
 * (ai-agents), and a deployment paused or resumed for one exact version.
 * No renderer holds the token.
 *
 * The shapes and the routes are `shared/apps.ts`'s; `AppsDeps` takes
 * the token, the services and `fetch` so the tests run without Electron.
 *
 * @module main/services/apps
 */

import { ipcMain } from 'electron';
import log from 'electron-log/main';
import {
  IPC,
  readAppUid,
  readDeploymentStateChange,
} from '../../shared/types/ipc.types';
import {
  deploymentUrl,
  landingOrigin,
  type AppDocument,
  type AppsListed,
  type AppDeployment,
  appDocumentOf,
  spacerAppUrl,
  listedAppsOf,
  spacerAppsUrl,
  appDeploymentOf,
  appDeploymentsOf,
  type DeploymentStateChange,
} from '../../shared/apps';
import { deploymentsUrl } from '../../shared/appChat';
import { isDevelopment } from '../app/environment';
import { servicesOf } from './app-chat';
import { sdkBridge } from './datalayer-sdk-bridge';

/** The sentence when nobody is signed in. */
export const APPS_SIGNED_OUT = 'Sign in to Datalayer to see your applications.';

/** What Apps' calls need of the world. */
export interface AppsDeps {
  /** The token, or null when nobody is signed in. */
  token: () => string | null;
  /** The Spacer and ai-agents base URLs. */
  services: () => { aiAgentsUrl: string; spacerUrl: string };
  /** The landing's origin. */
  landing: () => string;
  fetch: typeof fetch;
}

/**
 * A service's refusal in a sentence: its `detail` (a string, or its
 * `message`), else the status.
 *
 * @param response - The answer.
 * @param what - What was asked, for the sentence.
 *
 * @returns The sentence.
 */
async function refusal(response: Response, what: string): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: unknown;
      message?: unknown;
    };
    const detail = body.detail;
    if (typeof detail === 'string' && detail) {
      return `${what}: ${detail}`;
    }
    if (detail && typeof detail === 'object') {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string' && message) {
        return `${what}: ${message}`;
      }
    }
    if (typeof body.message === 'string' && body.message) {
      return `${what}: ${body.message}`;
    }
  } catch {
    // The status says it.
  }
  return `${what} (${response.status}).`;
}

/**
 * Apps' four calls, over the given world.
 *
 * @param deps - The token, the services, the landing, `fetch`.
 *
 * @returns The calls.
 */
export function appsCalls(deps: AppsDeps) {
  const signed = (): Record<string, string> => {
    const token = deps.token();
    if (!token) {
      throw new Error(APPS_SIGNED_OUT);
    }
    return { Authorization: `Bearer ${token}` };
  };
  const read = async (url: string, what: string): Promise<unknown> => {
    const response = await deps.fetch(url, { headers: signed() });
    if (!response.ok) {
      throw new Error(await refusal(response, what));
    }
    return response.json();
  };
  return {
    /** The person's applications, newest first, and the landing's origin. */
    async list(): Promise<AppsListed> {
      const body = await read(
        spacerAppsUrl(deps.services().spacerUrl),
        'Your applications could not be listed'
      );
      return { apps: listedAppsOf(body), landing: deps.landing() };
    },
    /** One application's Appspec. */
    async app(uid: string): Promise<AppDocument> {
      const body = await read(
        spacerAppUrl(deps.services().spacerUrl, uid),
        'The application could not be read'
      );
      return appDocumentOf(body, uid);
    },
    /** The person's deployments. */
    async deployments(): Promise<AppDeployment[]> {
      const body = await read(
        deploymentsUrl(deps.services().aiAgentsUrl),
        'Your deployments could not be listed'
      );
      return appDeploymentsOf(body);
    },
    /** A deployment paused or resumed, for one exact version. */
    async setState(change: DeploymentStateChange): Promise<AppDeployment> {
      const response = await deps.fetch(
        deploymentUrl(deps.services().aiAgentsUrl, change.uid),
        {
          method: 'PATCH',
          headers: { ...signed(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: change.version,
            state: change.state,
          }),
        }
      );
      const what =
        change.state === 'paused'
          ? 'The deployment could not be paused'
          : 'The deployment could not be resumed';
      if (!response.ok) {
        throw new Error(await refusal(response, what));
      }
      const body = (await response.json()) as Record<string, unknown>;
      const changed = appDeploymentOf(body.deployment);
      if (!changed) {
        throw new Error(`${what}: ai-agents answered no deployment.`);
      }
      return changed;
    },
  };
}

/** The app's calls: the SDK bridge's token, the configured services. */
export const apps = appsCalls({
  token: () =>
    sdkBridge.isAuthenticated() ? sdkBridge.getConfig().token || null : null,
  services: servicesOf,
  landing: () => landingOrigin(process.env, isDevelopment()),
  fetch: (...args) => fetch(...args),
});

/** Registers the `apps:*` handlers. */
export function registerAppsIpc(): void {
  const logged = <T>(what: string, call: () => Promise<T>): Promise<T> =>
    call().catch(error => {
      log.warn(`[Apps] ${what}:`, {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
  ipcMain.handle(IPC.appsList, () => logged('applications', () => apps.list()));
  ipcMain.handle(IPC.appsApp, (_event, argument: unknown) => {
    const uid = readAppUid(argument);
    return logged(`application ${uid}`, () => apps.app(uid));
  });
  ipcMain.handle(IPC.appsDeployments, () =>
    logged('deployments', () => apps.deployments())
  );
  ipcMain.handle(IPC.appsDeploymentState, (_event, argument: unknown) => {
    const change = readDeploymentStateChange(argument);
    return logged(`deployment ${change.uid} ${change.state}`, () =>
      apps.setState(change)
    );
  });
}
