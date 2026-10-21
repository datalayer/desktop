/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The app's entries on a session's menu (DESKTOP DK-10): which apply per
 * place and state, what each does through the session API and the ways
 * the page lends, what each says, and a refusal passed on as the runtime
 * said it.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type SessionActionContext,
  sessionActionsFor,
} from '@datalayer/agent-runtimes/lib/apps/core';
import { sessionRowOf } from '@datalayer/agent-runtimes/lib/portable/activity';
import { RuntimeRefusal } from '@datalayer/agent-runtimes/lib/portable/sessions';
import type { SessionPlace } from '@datalayer/agent-runtimes/lib/portable/sessionList';
import {
  DESKTOP_SESSION_ACTION_WORDS,
  desktopSessionActions,
  type DesktopSessionWays,
} from '../desktopSessionActions';

const LOCAL: SessionPlace = {
  kind: 'local',
  folder: '/w/app',
  folderName: 'app',
  url: 'http://127.0.0.1:4321',
};

const facts = (raw: Record<string, unknown> = {}) =>
  sessionRowOf({
    uid: 's-1',
    state: 'open',
    turn: 'idle',
    title: 'Fix the tests',
    app_uid: 'app-1',
    ...raw,
  });

function ways(place?: SessionPlace, typed?: string) {
  const w: DesktopSessionWays = {
    placeOf: () => place,
    askText: vi.fn(async () => typed),
    reveal: vi.fn(async () => undefined),
    openStudio: vi.fn(async () => undefined),
  };
  return w;
}

function context() {
  const said: string[] = [];
  const client = {
    rename: vi.fn(async () => ({})),
    archive: vi.fn(async () => ({})),
    end: vi.fn(async () => ({})),
  };
  const ctx = {
    client,
    say: (sentence: string) => said.push(sentence),
  } as unknown as SessionActionContext;
  return { ctx, said, client };
}

const entries = (w: DesktopSessionWays) =>
  desktopSessionActions(w).map(value => ({ value }));

describe('which entries apply', () => {
  it('offers rename, archive, end, reveal and the Studio for an open local session of an application', () => {
    expect(
      sessionActionsFor(entries(ways(LOCAL)), facts()).map(e => e.id)
    ).toEqual([
      'desktop-rename',
      'desktop-archive',
      'desktop-end',
      'desktop-reveal-in-finder',
      'desktop-open-in-studio',
    ]);
  });

  it('keeps the Finder for this machine, the Studio for an application', () => {
    expect(
      sessionActionsFor(entries(ways({ kind: 'datalayer' })), facts()).map(
        e => e.id
      )
    ).toEqual([
      'desktop-rename',
      'desktop-archive',
      'desktop-end',
      'desktop-open-in-studio',
    ]);
    expect(
      sessionActionsFor(entries(ways(LOCAL)), facts({ app_uid: '' })).map(
        e => e.id
      )
    ).toEqual([
      'desktop-rename',
      'desktop-archive',
      'desktop-end',
      'desktop-reveal-in-finder',
    ]);
    expect(
      sessionActionsFor(entries(ways(undefined)), facts({ app_uid: '' })).map(
        e => e.id
      )
    ).toEqual(['desktop-rename', 'desktop-archive', 'desktop-end']);
  });

  it('offers neither rename nor end on an ended session, nor archive on an archived one', () => {
    expect(
      sessionActionsFor(
        entries(ways(LOCAL)),
        facts({ state: 'ended', turn: '' })
      ).map(e => e.id)
    ).toEqual([
      'desktop-archive',
      'desktop-reveal-in-finder',
      'desktop-open-in-studio',
    ]);
    expect(
      sessionActionsFor(entries(ways(LOCAL)), facts({ archived: true })).map(
        e => e.id
      )
    ).not.toContain('desktop-archive');
  });
});

describe('what each does', () => {
  it('renames through the session API with the text asked, nothing when declined', async () => {
    const w = ways(LOCAL, 'Green tests');
    const { ctx, said, client } = context();
    const [rename] = desktopSessionActions(w);
    await rename.run(facts(), ctx);
    expect(w.askText).toHaveBeenCalledWith(
      DESKTOP_SESSION_ACTION_WORDS.renameTitle,
      'Fix the tests'
    );
    expect(client.rename).toHaveBeenCalledWith('s-1', 'Green tests');
    expect(said).toEqual(['Renamed to Green tests.']);
    const declined = context();
    await desktopSessionActions(ways(LOCAL, undefined))[0].run(
      facts(),
      declined.ctx
    );
    expect(declined.client.rename).not.toHaveBeenCalled();
    expect(declined.said).toEqual([]);
  });

  it('archives and ends through the session API', async () => {
    const { ctx, said, client } = context();
    const [, archive, end] = desktopSessionActions(ways(LOCAL));
    await archive.run(facts(), ctx);
    await end.run(facts(), ctx);
    expect(client.archive).toHaveBeenCalledWith('s-1', true);
    expect(client.end).toHaveBeenCalledWith('s-1');
    expect(said).toEqual([
      DESKTOP_SESSION_ACTION_WORDS.archived('s-1'),
      DESKTOP_SESSION_ACTION_WORDS.ended('s-1'),
    ]);
  });

  it('reveals the folder of a local session, and opens the application’s Activity in the Studio', async () => {
    const w = ways(LOCAL);
    const { ctx, said } = context();
    const [, , , reveal, studio] = desktopSessionActions(w);
    await reveal.run(facts(), ctx);
    await studio.run(facts(), ctx);
    expect(w.reveal).toHaveBeenCalledWith('/w/app');
    expect(w.openStudio).toHaveBeenCalledWith('app-1');
    expect(said).toEqual([
      '/w/app is shown in the Finder.',
      'Fix the tests is listed on Activity, with every session of the application.',
    ]);
  });

  it('passes the runtime’s refusal on as it said it (a 409 while a turn runs)', async () => {
    const { ctx, client } = context();
    client.end.mockRejectedValueOnce(
      new RuntimeRefusal(409, 'Session s-1 is answering: stop it first.')
    );
    const [, , end] = desktopSessionActions(ways(LOCAL));
    await expect(end.run(facts(), ctx)).rejects.toThrow(
      'Session s-1 is answering: stop it first.'
    );
  });
});
