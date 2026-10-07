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
 * @module main/services/app-chat
 */

import { session } from 'electron';
import log from 'electron-log/main';
import {
  type AppChatDeployments,
  deploymentChoicesOf,
  deploymentsUrl,
  lentHeaders,
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
 * ai-agents is served on the runtimes plane (core's `aiAgentsUrl`).
 *
 * @returns The two base URLs.
 */
function servicesOf(): { aiAgentsUrl: string; spacerUrl: string } {
  const config = sdkBridge.getConfig();
  return {
    aiAgentsUrl: config.runtimesUrl || '',
    spacerUrl: config.spacerUrl || '',
  };
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
    const deployments = deploymentChoicesOf(await response.json());
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
