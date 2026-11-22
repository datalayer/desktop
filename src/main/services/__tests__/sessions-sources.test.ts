/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The sessions list's two sources (DESKTOP DK-09): Datalayer read with the
 * token the main process holds, this machine's runtimes read with none;
 * the places merged, a session held elsewhere marked, a held row's folder
 * read again before 1.5.71, signed out and no runtime said in one note
 * each, a runtime that did not answer one note.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/nowhere' },
  safeStorage: { isEncryptionAvailable: () => false },
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@datalayer/core/lib/config/planes', () => ({
  DEFAULT_PLANE_URLS: { aiAgentsUrl: 'https://r1.datalayer.run' },
}));

vi.mock('../datalayer-sdk-bridge', () => ({
  sdkBridge: {
    getConfig: () => ({}),
    isAuthenticated: () => false,
    getAuthState: () => ({}),
  },
}));

const RECORDED = {
  sessions: [
    {
      uid: 'e67a52b2',
      app_uid: 'app-1',
      title: 'The refactor',
      agent: 'shield-mvp-codex',
      harness: 'codex',
      state: 'open',
      turn: '',
      held: false,
      turns: 5,
      lineage: { forked_from: null, imported_from: null },
      archived: false,
    },
  ],
  has_more: false,
};

const LOCAL = {
  sessions: [
    {
      uid: '7d2c4b10',
      app: { id: 'shield-mvp-claude-code', name: 'Shield MVP (Claude Code)' },
      agent: 'shield-mvp-claude-code',
      harness: 'claude-code',
      state: 'open',
      turn: 'waiting',
      held: true,
      turns: 1,
      title: 'Fix the tests',
      lineage: { forked_from: null, imported_from: null },
      archived: false,
    },
    {
      uid: 'e15ewh3r',
      app: { id: 'shield-mvp-codex', name: 'Shield MVP (Codex)' },
      agent: 'shield-mvp-codex',
      harness: 'codex',
      state: 'open',
      turn: '',
      held: false,
      turns: 3,
      title: 'In the editor',
      lineage: { forked_from: null, imported_from: null },
      archived: false,
    },
  ],
  has_more: false,
};

const RUNTIME = {
  folder: '/home/ada/project',
  folderName: 'project',
  url: 'http://127.0.0.1:41231',
  port: 41231,
  version: '1.5.70',
  credentials: {},
};

type Call = { url: string; authorization: string | undefined };

function fetchOf(
  answers: Record<string, unknown>,
  calls: Call[]
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, authorization: headers.Authorization });
    const key = Object.keys(answers).find(prefix => url.startsWith(prefix));
    if (!key) {
      throw new Error(`fetch failed: ${url}`);
    }
    const answer = answers[key];
    if (typeof answer === 'number') {
      return new Response(JSON.stringify({ detail: `status ${answer}` }), {
        status: answer,
      });
    }
    return new Response(JSON.stringify(answer), { status: 200 });
  }) as typeof fetch;
}

describe('the two sources', () => {
  const load = async () =>
    (await import('../sessions-sources')).createSessionsSources;

  it('reads Datalayer with the token and this machine with none, and merges the places', async () => {
    const calls: Call[] = [];
    const create = await load();
    const sources = create({
      signedIn: () => ({
        token: 'jwt',
        uid: '01jq',
        aiAgentsUrl: 'https://r1.datalayer.run',
      }),
      runtimes: () => [RUNTIME],
      folders: () => ({
        folders: ['/home/ada/project'],
        last: '/home/ada/project',
      }),
      fetch: fetchOf(
        {
          'https://r1.datalayer.run/api/ai-agents/v1/apps/sessions?opened_by=01jq':
            RECORDED,
          'http://127.0.0.1:41231/api/v1/apps/sessions/7d2c4b10': {
            ...LOCAL.sessions[0],
            harness_session: {
              acp_session_id: 'x',
              workspace: '/home/ada/project',
            },
          },
          'http://127.0.0.1:41231/api/v1/apps/sessions': LOCAL,
        },
        calls
      ),
      log: vi.fn(),
    });
    const listed = await sources.list();
    expect(listed.signedIn).toBe(true);
    expect(listed.places.map(place => place.place.kind)).toEqual([
      'datalayer',
      'local',
    ]);
    const [datalayer, local] = listed.places;
    expect(datalayer?.groups[0]?.sessions[0]?.row.uid).toBe('e67a52b2');
    expect(datalayer?.note).toBe('');
    const rows = local?.groups.flatMap(group => group.sessions) ?? [];
    expect(rows.map(row => row.row.uid)).toEqual(['7d2c4b10', 'e15ewh3r']);
    // The held row's folder, read again at GET /sessions/{uid} before 1.5.71.
    expect(rows[0]?.workspace).toBe('/home/ada/project');
    expect(rows[0]?.elsewhere).toBe(false);
    // Open and held by none of the app's runtimes: VS Code's or a terminal's.
    expect(rows[1]?.elsewhere).toBe(true);
    expect(rows[1]?.workspace).toBe('');
    const datalayerCall = calls.find(call => call.url.startsWith('https://'));
    expect(datalayerCall?.authorization).toBe('Bearer jwt');
    for (const call of calls.filter(call =>
      call.url.startsWith('http://127.0.0.1')
    )) {
      expect(call.authorization).toBeUndefined();
    }
    expect(sources.lastRows().map(row => [row.key, row.turn])).toEqual([
      ['e67a52b2', ''],
      ['7d2c4b10', 'waiting'],
      ['e15ewh3r', ''],
    ]);
  });

  it('says signed out, no session on this machine yet, and a runtime that did not answer, in one note each', async () => {
    const create = await load();
    const signedOut = create({
      signedIn: () => null,
      runtimes: () => [],
      folders: () => ({ folders: [], last: null }),
      fetch: fetchOf({}, []),
      log: vi.fn(),
    });
    const listed = await signedOut.list();
    expect(listed.signedIn).toBe(false);
    expect(listed.places[0]?.note).toBe(
      'Sign in to Datalayer to see your sessions there.'
    );
    expect(listed.places[1]?.note).toBe(
      'No session on this machine yet — File → Work in a folder…'
    );

    const remembered = create({
      signedIn: () => null,
      runtimes: () => [],
      folders: () => ({
        folders: ['/home/ada/project'],
        last: '/home/ada/project',
      }),
      fetch: fetchOf({}, []),
      log: vi.fn(),
    });
    expect((await remembered.list()).places[1]?.note).toBe(
      'No local runtime is running: start a coding agent in a folder, or File → Work in a folder….'
    );

    const gone = create({
      signedIn: () => ({
        token: 'jwt',
        uid: '01jq',
        aiAgentsUrl: 'https://r1.datalayer.run',
      }),
      runtimes: () => [RUNTIME],
      folders: () => ({
        folders: ['/home/ada/project'],
        last: '/home/ada/project',
      }),
      fetch: fetchOf({ 'https://r1.datalayer.run/': 503 }, []),
      log: vi.fn(),
    });
    const notes = (await gone.list()).places.map(place => place.note);
    expect(notes[0]).toBe(
      'Datalayer did not answer for your sessions: status 503'
    );
    expect(notes[1]).toBe(
      'The local runtime of project did not answer: fetch failed: http://127.0.0.1:41231/api/v1/apps/sessions'
    );
  });
});
