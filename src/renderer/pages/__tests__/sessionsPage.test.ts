/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Sessions page's view model (DESKTOP DK-07, DK-09): the merged list
 * paged, the entries by uid, and what opening a row does — a session held
 * in VS Code or a terminal refused until paused (D-12), an ended one, a
 * folder unknown (DK-26), an application not kept always on, the folder's
 * runtime started first.
 */

import { describe, expect, it } from 'vitest';
import { sessionRowOf } from '@datalayer/agent-runtimes/lib/portable/activity';
import {
  ELSEWHERE_SENTENCE,
  mergePlaces,
  type SessionEntry,
  type SessionPlace,
  type SessionsOfPlace,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type { AppChatChoice } from '../../../shared/appChat';
import {
  acceptedExtensionsOf,
  drawPlaces,
  entriesByUid,
  folderNameOf,
  localPlaceOf,
  openDecision,
  PAGE_SIZE,
  RECENT_SIZE,
  recentEntries,
  SESSIONS_WORDS,
} from '../sessionsPage';

const DATALAYER: SessionPlace = { kind: 'datalayer' };
const LOCAL: SessionPlace = {
  kind: 'local',
  folder: '/home/me/work/app',
  folderName: 'app',
  url: 'http://127.0.0.1:4321',
};
const RUNNING = [
  { folder: '/home/me/work/app', folderName: 'app', url: LOCAL.url },
];

/** A listed session built from the real row reader. */
function listed(raw: Record<string, unknown>, workspace = '') {
  return {
    row: sessionRowOf({
      uid: 's-1',
      state: 'open',
      turn: 'idle',
      held: true,
      agent: 'shield-mvp-claude-code',
      harness: 'claude-code',
      title: 'Fix the tests',
      turns: 3,
      app_uid: 'app-1',
      ...raw,
    }),
    application: { key: 'app-1', name: 'Shield MVP' },
    workspace,
  };
}

/** One entry of the merged list, as the main process answers it. */
function entry(
  raw: Record<string, unknown>,
  place: SessionPlace,
  workspace = ''
): SessionEntry {
  const merged = mergePlaces([
    { place, sessions: [listed(raw, workspace)] } as SessionsOfPlace,
  ]);
  return merged[0].groups[0].sessions[0];
}

describe('the list paged', () => {
  it('shows the first page across the places and counts the rest', () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) =>
      listed({ uid: `l-${i}`, title: `Local ${i}` }, '/home/me/work/app')
    );
    const places = mergePlaces([
      {
        place: DATALAYER,
        sessions: [listed({ uid: 'a' }), listed({ uid: 'b' })],
      },
      { place: LOCAL, sessions: many },
    ]);
    const drawn = drawPlaces(places);
    expect(drawn.places[0].groups[0].sessions).toHaveLength(2);
    expect(drawn.places[1].groups[0].sessions).toHaveLength(PAGE_SIZE - 2);
    expect(drawn.left).toBe(7);
    expect(drawPlaces(places, PAGE_SIZE * 2).left).toBe(0);
    expect(SESSIONS_WORDS.showMore(7)).toBe('Show 7 more (7 left)');
  });

  it('keeps a place’s note, and knows every entry by uid', () => {
    const places = mergePlaces([
      { place: DATALAYER, sessions: [listed({ uid: 'a' })] },
      { place: LOCAL, problem: 'connection refused' },
    ]);
    const drawn = drawPlaces(places);
    expect(drawn.places[1].note).toBe(
      'The local runtime of app did not answer: connection refused'
    );
    expect(entriesByUid(places).get('a')?.place).toEqual(DATALAYER);
    expect(entriesByUid(places).has('zzz')).toBe(false);
  });
});

describe('the home pane, when no session is in front', () => {
  it('offers the newest sessions of both places, neither ended nor archived', () => {
    const places = mergePlaces([
      {
        place: DATALAYER,
        sessions: [
          listed({ uid: 'd-old', started_at: '2026-10-01T09:00:00Z' }),
          listed({
            uid: 'd-ended',
            state: 'ended',
            started_at: '2026-10-21T09:00:00Z',
          }),
        ],
      },
      {
        place: LOCAL,
        sessions: [
          listed(
            { uid: 'l-new', started_at: '2026-10-20T09:00:00Z' },
            '/home/me/work/app'
          ),
          listed(
            {
              uid: 'l-archived',
              archived: true,
              started_at: '2026-10-21T10:00:00Z',
            },
            '/home/me/work/app'
          ),
          listed(
            {
              uid: 'l-mid',
              state: 'paused',
              started_at: '2026-10-10T09:00:00Z',
            },
            '/home/me/work/app'
          ),
        ],
      },
    ]);
    expect(recentEntries(places).map(entry => entry.row.uid)).toEqual([
      'l-new',
      'l-mid',
      'd-old',
    ]);
    expect(recentEntries(places)[0].place).toEqual(LOCAL);
    expect(recentEntries(places, 1).map(entry => entry.row.uid)).toEqual([
      'l-new',
    ]);
    expect(recentEntries([])).toEqual([]);
  });

  it('offers five at most', () => {
    const many = Array.from({ length: RECENT_SIZE + 3 }, (_, i) =>
      listed(
        { uid: `r-${i}`, started_at: `2026-10-${10 + i}T09:00:00Z` },
        '/home/me/work/app'
      )
    );
    const recent = recentEntries(
      mergePlaces([{ place: LOCAL, sessions: many }])
    );
    expect(recent).toHaveLength(RECENT_SIZE);
    expect(recent[0].row.uid).toBe(`r-${RECENT_SIZE + 2}`);
  });
});

describe('places and folders', () => {
  it('names a folder by its last segment, and a runtime as a place', () => {
    expect(folderNameOf('/home/me/work/app/')).toBe('app');
    expect(folderNameOf('C:\\work\\app')).toBe('app');
    expect(
      localPlaceOf({
        folder: '/w/x',
        folderName: '',
        url: 'http://127.0.0.1:1',
      })
    ).toEqual({
      kind: 'local',
      folder: '/w/x',
      folderName: 'x',
      url: 'http://127.0.0.1:1',
    });
  });

  it('turns the chat’s accept into extensions for the open dialog', () => {
    expect(acceptedExtensionsOf('.jsonl,application/x-ndjson')).toEqual([
      'jsonl',
    ]);
    expect(acceptedExtensionsOf('application/x-ndjson')).toEqual(['jsonl']);
  });
});

describe('opening a row', () => {
  const kept: AppChatChoice = {
    kind: 'talk',
    handle: {
      uid: 'd-1',
      appUid: 'app-1',
      name: 'Shield MVP',
      version: 3,
      target: 'hosted',
      slug: 'shield',
      url: 'https://r1.datalayer.run/agent-runtimes/rt-1',
      agentId: 'agent-1',
    },
  };
  const closed: AppChatChoice = {
    kind: 'closed',
    uid: 'd-2',
    name: 'Other',
    why: 'paused',
  };

  it('opens a local session held here on its runtime, with the row’s agent', () => {
    const decision = openDecision(
      entry({}, LOCAL, '/home/me/work/app'),
      RUNNING,
      []
    );
    expect(decision.target).toMatchObject({
      kind: 'local',
      uid: 's-1',
      agent: 'shield-mvp-claude-code',
      place: LOCAL,
    });
    expect(decision.said).toBe(
      'Fix the tests (Open): its conversation is open here.'
    );
  });

  it('refuses a session open in VS Code or a terminal until it is paused (D-12), and an ended one', () => {
    const elsewhere = openDecision(
      entry({ held: false }, LOCAL, '/home/me/elsewhere'),
      RUNNING,
      []
    );
    expect(elsewhere.target).toBeNull();
    expect(elsewhere.said).toBe(ELSEWHERE_SENTENCE);
    const ended = openDecision(
      entry({ state: 'ended', turn: '', held: false }, LOCAL),
      RUNNING,
      []
    );
    expect(ended.target).toBeNull();
    expect(ended.said).toMatch(/has ended: clone it/);
  });

  it('resumes a paused local session on its folder’s runtime, started first when it is not running', () => {
    const paused = entry(
      { state: 'paused', turn: '', held: false },
      LOCAL,
      '/home/me/other'
    );
    const decision = openDecision(paused, RUNNING, []);
    expect(decision.target).toBeNull();
    expect(decision.startFolder).toBe('/home/me/other');
    const running = openDecision(
      paused,
      [
        ...RUNNING,
        {
          folder: '/home/me/other',
          folderName: 'other',
          url: 'http://127.0.0.1:5000',
        },
      ],
      []
    );
    expect(running.target).toMatchObject({
      kind: 'local',
      place: { url: 'http://127.0.0.1:5000', folderName: 'other' },
    });
  });

  it('says a paused local session’s folder is unknown (DK-26 not yet answered)', () => {
    const decision = openDecision(
      entry({ state: 'paused', turn: '', held: false }, LOCAL),
      RUNNING,
      []
    );
    expect(decision.target).toBeNull();
    expect(decision.said).toBe(SESSIONS_WORDS.resumeFolderUnknown('s-1'));
  });

  it('opens a session on Datalayer on the kept deployment of its application, else says why not', () => {
    const opened = openDecision(entry({}, DATALAYER), RUNNING, [closed, kept]);
    expect(opened.target).toMatchObject({
      kind: 'datalayer',
      uid: 's-1',
      handle: { uid: 'd-1', agentId: 'agent-1' },
    });
    const refused = openDecision(entry({}, DATALAYER), RUNNING, [closed]);
    expect(refused.target).toBeNull();
    expect(refused.said).toBe(SESSIONS_WORDS.noDeployment('Fix the tests'));
  });
});
