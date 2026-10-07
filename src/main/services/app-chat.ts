/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * A deployed application's agent, the main process's side (STUDIO A-20).
 *
 * The main process lists the person's deployments at ai-agents
 * (`GET /api/ai-agents/v1/apps/deployments`, on the runtimes plane) with the
 * token it holds, and answers the renderer each one talked to or said why
 * not (`deploymentChoicesOf`). The runtimes those deployments are kept on,
 * ai-agents' Tool Approvals and Spacer's items become the prefixes it
 * signs: the session's `webRequest` lends the person's token to the
 * renderer's requests under them (`lentHeaders`), and to nothing else — the
 * view of an application never asks for it, as VS Code's network bridge
 * lends it to its webview (A-18).
 *
 * The renderer reaches only what the window's Content Security Policy lets
 * it (`connect-src`): the Datalayer domains and the configured services'
 * origins (`appChatConnectSources`, read by the security manager). A
 * deployment kept on a runtime elsewhere is listed closed, with why.
 *
 * An application that takes only a signed user (D-21) is signed for the
 * person here — ai-agents asked with the token this process holds
 * (`app-chat:user-token`, `fetchUserToken`) — and only the short user token
 * reaches the renderer, which sends it with each run.
 *
 * @module main/services/app-chat
 */

import { session } from 'electron';
import log from 'electron-log/main';
import { DEFAULT_PLANE_URLS } from '@datalayer/core/lib/config/planes';
import {
  type AppChatChoice,
  type AppChatDeployments,
  deploymentChoicesOf,
  deploymentsUrl,
  fetchUserToken,
  lentHeaders,
  type SignedUser,
  signedPrefixesOf,
} from '../../shared/appChat';
import { sdkBridge } from './datalayer-sdk-bridge';

/**
 * The URL prefixes the session signs with the person's token: those of the
 * deployments last listed. Empty while nobody is signed in or nothing is
 * listed.
 */
let signedPrefixes: string[] = [];

/** Whether the session's `webRequest` lends the token yet. */
let lending = false;

/**
 * The ai-agents and Spacer base URLs, from the client's configuration:
 * ai-agents is core's `aiAgentsUrl` (on the runtimes plane unless set
 * otherwise with `DATALAYER_AI_AGENTS_URL`), never the runtimes' URL.
 *
 * @returns The two base URLs.
 */
function servicesOf(): { aiAgentsUrl: string; spacerUrl: string } {
  const config = sdkBridge.getConfig();
  return {
    aiAgentsUrl:
      process.env.DATALAYER_AI_AGENTS_URL || DEFAULT_PLANE_URLS.aiAgentsUrl,
    spacerUrl: config.spacerUrl || DEFAULT_PLANE_URLS.spacerUrl,
  };
}

/** The Datalayer domains the renderer always reaches. */
export const DATALAYER_CONNECT_SOURCES = [
  'https://prod1.datalayer.run',
  'https://*.datalayer.io',
  'https://*.datalayer.run',
  'wss://*.datalayer.run',
  'wss://*.datalayer.io',
] as const;

/**
 * An HTTPS origin, or `""` for anything else.
 *
 * @param url - A configured URL.
 *
 * @returns Its origin.
 */
function httpsOrigin(url: string | undefined): string {
  try {
    const parsed = new URL(url || '');
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
}

/**
 * What the window's `connect-src` names for the chats of applications: the
 * Datalayer domains and the configured services' HTTPS origins (IAM, the
 * runtimes, Spacer, ai-agents) — validated, so nothing else is let in.
 *
 * @returns The sources, without duplicates.
 */
export function appChatConnectSources(): string[] {
  const config = sdkBridge.getConfig();
  const services = servicesOf();
  const configured = [
    config.iamUrl,
    config.runtimesUrl,
    services.spacerUrl,
    services.aiAgentsUrl,
  ]
    .map(httpsOrigin)
    .filter(Boolean);
  return [...new Set([...DATALAYER_CONNECT_SOURCES, ...configured])];
}

/**
 * Whether the renderer reaches an origin under the sources the window's
 * `connect-src` names (`https://*.datalayer.run` matches a subdomain).
 *
 * @param origin - An HTTPS origin.
 * @param sources - What {@link appChatConnectSources} gave.
 *
 * @returns Whether a request to it is let through.
 */
export function reachedUnder(
  origin: string,
  sources: readonly string[]
): boolean {
  return sources.some(source => {
    if (!source.startsWith('https://')) {
      return false;
    }
    const wildcard = source.match(/^https:\/\/\*\.(.+)$/);
    if (wildcard) {
      try {
        const host = new URL(origin).hostname;
        return (
          origin.startsWith('https://') && host.endsWith(`.${wildcard[1]}`)
        );
      } catch {
        return false;
      }
    }
    return source === origin;
  });
}

/**
 * The choices, a deployment kept on a runtime the window does not reach
 * listed closed with why.
 *
 * @param choices - The choices, as ai-agents answered them.
 *
 * @returns The choices Desktop can keep.
 */
function reachableChoices(choices: AppChatChoice[]): AppChatChoice[] {
  const sources = appChatConnectSources();
  return choices.map((choice): AppChatChoice => {
    if (choice.kind !== 'talk') {
      return choice;
    }
    const origin = httpsOrigin(choice.handle.url);
    return origin && reachedUnder(origin, sources)
      ? choice
      : {
          kind: 'closed',
          uid: choice.handle.uid,
          name: choice.handle.name,
          why: `${choice.handle.name} is kept on ${origin || choice.handle.url}, which Desktop does not reach.`,
        };
  });
}

/**
 * Lends the person's token to the renderer's requests under the signed
 * prefixes, once: Electron takes one `onBeforeSendHeaders` listener per
 * session, and this is the app's only one.
 */
export function lendTokenToAppChats(): void {
  if (lending) {
    return;
  }
  lending = true;
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*/*'] },
    (details, callback) => {
      if (signedPrefixes.length === 0) {
        callback({ requestHeaders: details.requestHeaders });
        return;
      }
      const token = sdkBridge.isAuthenticated()
        ? sdkBridge.getConfig().token
        : undefined;
      callback({
        requestHeaders: lentHeaders(
          details.url,
          details.requestHeaders,
          token,
          signedPrefixes
        ),
      });
    }
  );
}

/** Forgets the prefixes: nothing is signed until the deployments are listed again. */
export function forgetAppChats(): void {
  signedPrefixes = [];
}

/**
 * Lists the person's deployments at ai-agents; the runtimes they are kept
 * on become the prefixes the session signs.
 *
 * @returns The deployments and the services' base URLs.
 *
 * @throws When nobody is signed in or ai-agents refuses, with its sentence.
 */
export async function listAppChatDeployments(): Promise<AppChatDeployments> {
  const services = servicesOf();
  const token = sdkBridge.getConfig().token;
  if (!sdkBridge.isAuthenticated() || !token) {
    signedPrefixes = [];
    throw new Error('Sign in to Datalayer to talk to your applications.');
  }
  try {
    const response = await fetch(deploymentsUrl(services.aiAgentsUrl), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      let detail = '';
      try {
        const body = (await response.json()) as { detail?: unknown };
        detail = typeof body.detail === 'string' ? body.detail : '';
      } catch {
        // The status says it.
      }
      throw new Error(
        detail || `ai-agents answered ${response.status} for your deployments.`
      );
    }
    const deployments = reachableChoices(
      deploymentChoicesOf(await response.json())
    );
    signedPrefixes = signedPrefixesOf(
      deployments.flatMap(choice =>
        choice.kind === 'talk' ? [choice.handle] : []
      ),
      services
    );
    return { deployments, services };
  } catch (error) {
    signedPrefixes = [];
    log.warn('[AppChat] Failed to list deployments', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Signs the person for a deployment that takes only a signed user (D-21):
 * ai-agents asked with the token this process holds; only the short user
 * token, for that deployment, goes back to the renderer.
 *
 * @param deploymentUid - The deployment talked to.
 *
 * @returns The user token and when it ends.
 *
 * @throws With ai-agents' sentence when it refuses.
 */
export async function appChatUserToken(
  deploymentUid: string
): Promise<SignedUser> {
  const token = sdkBridge.getConfig().token;
  if (!sdkBridge.isAuthenticated() || !token) {
    throw new Error('Sign in to Datalayer to talk to your applications.');
  }
  if (typeof deploymentUid !== 'string' || !deploymentUid.trim()) {
    throw new Error(
      'A user token is signed for one deployment, and none was named.'
    );
  }
  return fetchUserToken(servicesOf().aiAgentsUrl, deploymentUid, token);
}
