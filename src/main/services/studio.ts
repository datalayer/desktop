/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Studio, native — the main process's side (DESKTOP DK-02). The
 * *Studio* tab is the app's own React page; what it reads of Datalayer is
 * read here, with the token this process holds, and handed over IPC as the
 * Sessions page's lists are: the person's applications (Spacer), one
 * application's Appspec (its Spacer item), the person's deployments
 * (ai-agents), and a deployment paused or resumed for one exact version.
 * No renderer holds the token.
 *
 * The shapes and the routes are `shared/studio.ts`'s; `StudioDeps` takes
 * the token, the services and `fetch` so the tests run without Electron.
 *
 * @module main/services/studio
 */

import { ipcMain } from 'electron';
import log from 'electron-log/main';
import {
  IPC,
  readStudioAppUid,
  readStudioStateChange,
} from '../../shared/types/ipc.types';
import {
  deploymentUrl,
  landingOrigin,
  type StudioAppDocument,
  type StudioAppsListed,
  type StudioDeployment,
  studioAppDocumentOf,
  studioAppUrl,
  studioAppsOf,
  studioAppsUrl,
  studioDeploymentOf,
  studioDeploymentsOf,
  type StudioStateChange,
} from '../../shared/studio';
import { deploymentsUrl } from '../../shared/appChat';
import { isDevelopment } from '../app/environment';
import { servicesOf } from './app-chat';
import { sdkBridge } from './datalayer-sdk-bridge';

/** The sentence when nobody is signed in. */
export const STUDIO_SIGNED_OUT =
  'Sign in to Datalayer to see your applications.';

/** What the Studio's calls need of the world. */
export interface StudioDeps {
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
 * The Studio's four calls, over the given world.
 *
 * @param deps - The token, the services, the landing, `fetch`.
 *
 * @returns The calls.
 */
export function studioCalls(deps: StudioDeps) {
  const signed = (): Record<string, string> => {
    const token = deps.token();
    if (!token) {
      throw new Error(STUDIO_SIGNED_OUT);
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
    async apps(): Promise<StudioAppsListed> {
      const body = await read(
        studioAppsUrl(deps.services().spacerUrl),
        'Your applications could not be listed'
      );
      return { apps: studioAppsOf(body), landing: deps.landing() };
    },
    /** One application's Appspec. */
    async app(uid: string): Promise<StudioAppDocument> {
      const body = await read(
        studioAppUrl(deps.services().spacerUrl, uid),
        'The application could not be read'
      );
      return studioAppDocumentOf(body, uid);
    },
    /** The person's deployments. */
    async deployments(): Promise<StudioDeployment[]> {
      const body = await read(
        deploymentsUrl(deps.services().aiAgentsUrl),
        'Your deployments could not be listed'
      );
      return studioDeploymentsOf(body);
    },
    /** A deployment paused or resumed, for one exact version. */
    async setState(change: StudioStateChange): Promise<StudioDeployment> {
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
      const changed = studioDeploymentOf(body.deployment);
      if (!changed) {
        throw new Error(`${what}: ai-agents answered no deployment.`);
      }
      return changed;
    },
  };
}

/** The app's calls: the SDK bridge's token, the configured services. */
export const studio = studioCalls({
  token: () =>
    sdkBridge.isAuthenticated() ? sdkBridge.getConfig().token || null : null,
  services: servicesOf,
  landing: () => landingOrigin(process.env, isDevelopment()),
  fetch: (...args) => fetch(...args),
});

/** Registers the `studio:*` handlers. */
export function registerStudioIpc(): void {
  const logged = <T>(what: string, call: () => Promise<T>): Promise<T> =>
    call().catch(error => {
      log.warn(`[Studio] ${what}:`, {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
  ipcMain.handle(IPC.studioApps, () =>
    logged('applications', () => studio.apps())
  );
  ipcMain.handle(IPC.studioApp, (_event, argument: unknown) => {
    const uid = readStudioAppUid(argument);
    return logged(`application ${uid}`, () => studio.app(uid));
  });
  ipcMain.handle(IPC.studioDeployments, () =>
    logged('deployments', () => studio.deployments())
  );
  ipcMain.handle(IPC.studioDeploymentState, (_event, argument: unknown) => {
    const change = readStudioStateChange(argument);
    return logged(`deployment ${change.uid} ${change.state}`, () =>
      studio.setState(change)
    );
  });
}
