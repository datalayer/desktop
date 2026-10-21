/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Reactor the chat reads from (DESKTOP DK-01): the Shield's two display
 * renderers, drawn from a recorded session's displays; the session entries
 * — the chat's five, then the app's — in their order.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Renderers } from '@datalayer/reactor/ui';
import { LoopSessionAction } from '@datalayer/agent-runtimes/lib/apps/core';
import {
  SHIELD_DIFF_TYPE,
  SHIELD_TERMINAL_TYPE,
} from '@datalayer/agent-runtimes/lib/portable/displays';
import { shieldDisplayFixtures } from '@datalayer/agent-runtimes/lib/portable/fixtures';
import { buildDesktopReactor } from '../desktopReactor';
import {
  desktopSessionActions,
  type DesktopSessionWays,
} from '../desktopSessionActions';

const ways: DesktopSessionWays = {
  placeOf: () => undefined,
  askText: async () => undefined,
  reveal: async () => undefined,
  openStudio: async () => undefined,
};

describe('the desktop Reactor (DK-01)', () => {
  it('carries the session entries: the chat’s five, then the app’s', async () => {
    const reactor = buildDesktopReactor(desktopSessionActions(ways));
    reactor.start();
    await reactor.whenReady();
    const ids = reactor
      .getContributions(LoopSessionAction)
      .map(entry => entry.value.id);
    expect(ids).toEqual([
      'switch-agent',
      'clone-from-here',
      'export',
      'import',
      'resume',
      'desktop-rename',
      'desktop-archive',
      'desktop-end',
      'desktop-reveal-in-finder',
      'desktop-open-in-studio',
    ]);
    reactor.stop();
  });

  it('draws the diff and terminal rows from a recorded session’s displays', async () => {
    const reactor = buildDesktopReactor([]);
    reactor.start();
    await reactor.whenReady();
    const renderers = reactor.getContributions(Renderers).map(c => c.value);
    const fixtures = shieldDisplayFixtures();
    const diff = renderers.find(r => r.type === SHIELD_DIFF_TYPE);
    const terminal = renderers.find(r => r.type === SHIELD_TERMINAL_TYPE);
    expect(diff).toBeDefined();
    expect(terminal).toBeDefined();
    const Diff = diff?.component as React.ComponentType<{ display: unknown }>;
    const Terminal = terminal?.component as React.ComponentType<{
      display: unknown;
    }>;
    const diffHtml = renderToStaticMarkup(
      createElement(Diff, { display: fixtures.diff })
    );
    expect(diffHtml).toContain('hello.py');
    expect(diffHtml).toContain('shield');
    const terminalHtml = renderToStaticMarkup(
      createElement(Terminal, { display: fixtures.terminal })
    );
    expect(terminalHtml).toContain('pytest -q');
    expect(terminalHtml).toContain('3 passed');
    reactor.stop();
  });
});
