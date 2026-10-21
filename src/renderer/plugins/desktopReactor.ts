/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Reactor the chat reads from (DESKTOP DK-01): registered once for the
 * renderer, it carries the Shield's display renderers — a diff in the
 * file's language, a terminal's command and output, drawn in the chat's
 * tool rows (`ShieldDisplaysPlugin`, Agent Runtimes' own) — and the
 * `loop.session.action` entries a session's `⋯` menu is drawn from: the
 * chat's five (`CHAT_SESSION_ACTIONS`, imported, never copied) and the
 * app's own (`desktopSessionActions`).
 *
 * `<Chat sessionActions>` draws its menu from whatever Reactor is
 * registered on the page, so this is what makes the menu appear.
 *
 * @module renderer/plugins/desktopReactor
 */

import {
  buildReactorFromPlugins,
  contribution,
  definePlugin,
  type ReactorPlatform,
} from '@datalayer/reactor';
import { registerReactor } from '@datalayer/reactor/react';
import {
  LoopSessionAction,
  type SessionActionContribution,
} from '@datalayer/agent-runtimes/lib/apps/core';
import { CHAT_SESSION_ACTIONS } from '@datalayer/agent-runtimes/lib/apps/plugins/chat/sessionActions';
import { ShieldDisplaysPlugin } from '@datalayer/agent-runtimes/lib/apps/plugins/shield-displays';

/** The plugin carrying the session entries. */
export const DESKTOP_SESSIONS_PLUGIN_NAME =
  '@datalayer/desktop-plugin-sessions';

/**
 * The plugin contributing the session entries: the chat's own, then the
 * app's.
 *
 * @param own - The app's entries.
 *
 * @returns The plugin.
 */
export function desktopSessionsPlugin(
  own: readonly SessionActionContribution[]
) {
  const entries = [...CHAT_SESSION_ACTIONS, ...own];
  return definePlugin({
    name: DESKTOP_SESSIONS_PLUGIN_NAME,
    displayName: 'Sessions in Datalayer Desktop',
    description:
      'What a session’s menu offers: resume, switch agent, clone, export, import; rename, archive, end; the folder revealed, the Studio opened.',
    octicon: 'comment-discussion',
    emoji: '\u{1F4AC}',
    contributes: entries.map(entry =>
      contribution(LoopSessionAction, entry, {
        id: entry.id,
        order: entry.order,
      })
    ),
  });
}

/**
 * Builds the Reactor: the Shield's displays, the session entries.
 *
 * @param own - The app's entries.
 *
 * @returns The platform, not started.
 */
export function buildDesktopReactor(
  own: readonly SessionActionContribution[]
): ReactorPlatform {
  return buildReactorFromPlugins([
    ShieldDisplaysPlugin as never,
    desktopSessionsPlugin(own) as never,
  ]);
}

let registered: ReactorPlatform | null = null;

/**
 * Registers the Reactor for the renderer, once: started, so its
 * contributions are there for the chat to read, and published to the
 * store `<Chat>` and the menus read it from.
 *
 * @param own - The app's entries.
 *
 * @returns The platform registered.
 */
export function registerDesktopReactor(
  own: readonly SessionActionContribution[]
): ReactorPlatform {
  if (registered) {
    return registered;
  }
  const reactor = buildDesktopReactor(own);
  reactor.start();
  registerReactor(reactor);
  registered = reactor;
  return reactor;
}
