/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The OS tells the person (DESKTOP DK-14): a banner for a finished turn, a
 * question asked, a runtime gone and an approval raised — for every session
 * but the one in front; a dock bounce or a taskbar flash instead of a
 * banner while the app is frontmost; the body names the class and never
 * the arguments; the badge counts the sessions waiting; the tray lists
 * them with Open; a click focuses the session or the approval.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/nowhere', setBadgeCount: vi.fn() },
  BrowserWindow: { getFocusedWindow: () => null },
  Menu: { buildFromTemplate: vi.fn() },
  nativeImage: { createFromDataURL: vi.fn() },
  Notification: vi.fn(),
  Tray: vi.fn(),
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../app/window-manager', () => ({ getMainWindow: () => null }));

import type { AttentionOs } from '../attention';
import type { SessionAttention } from '@datalayer/agent-runtimes/lib/portable/attention';

interface Fake extends AttentionOs {
  banners: Array<{ body: string; click: () => void }>;
  cues: number;
  badges: number[];
  trays: Array<{ tooltip: string; labels: string[] }>;
  focused: unknown[];
  front: boolean;
}

function fakeOs(): Fake {
  const fake: Fake = {
    banners: [],
    cues: 0,
    badges: [],
    trays: [],
    focused: [],
    front: false,
    frontmost: () => fake.front,
    notify: (_title, body, onClick) =>
      fake.banners.push({ body, click: onClick }),
    cue: () => {
      fake.cues += 1;
    },
    badge: count => fake.badges.push(count),
    tray: (tooltip, entries) =>
      fake.trays.push({ tooltip, labels: entries.map(entry => entry.label) }),
    focus: target => fake.focused.push(target),
    sound: () => false,
  };
  return fake;
}

const session = (
  key: string,
  turn: SessionAttention['turn'],
  rest: Partial<SessionAttention> = {}
): SessionAttention => ({
  key,
  title: `Session ${key}`,
  agent: 'shield-mvp-claude-code',
  state: 'open',
  turn,
  held: true,
  inFront: false,
  ...rest,
});

describe('the OS told', () => {
  const load = async () => (await import('../attention')).createAttention;

  it('says a finished turn and a question for every session but the one in front, and a click focuses it', async () => {
    const os = fakeOs();
    const attention = (await load())(os);
    attention.front('b');
    os.front = true;
    attention.sessions([session('a', 'running'), session('b', 'running')]);
    // Frontmost: a cue, no banner — and b, in front, nothing.
    attention.sessions([
      session('a', 'idle', { lastAnswer: 'Done: three files changed.' }),
      session('b', 'idle', { lastAnswer: 'Never said' }),
    ]);
    expect(os.banners).toEqual([]);
    expect(os.cues).toBe(1);
    // Not frontmost: banners, the session in front included (the person is elsewhere).
    os.front = false;
    attention.sessions([session('a', 'running'), session('b', 'running')]);
    attention.sessions([
      session('a', 'waiting'),
      session('b', 'idle', { lastAnswer: 'Over.' }),
    ]);
    expect(os.banners.map(banner => banner.body)).toEqual([
      'Session a is waiting for you.',
      'Over.',
    ]);
    os.banners[0]?.click();
    expect(os.focused).toEqual([{ uid: 'a' }]);
  });

  it('counts the sessions waiting in the badge and lists them in the tray, once per change', async () => {
    const os = fakeOs();
    const attention = (await load())(os);
    attention.sessions([
      session('a', 'waiting'),
      session('b', 'waiting'),
      session('c', 'running'),
    ]);
    attention.sessions([
      session('a', 'waiting'),
      session('b', 'waiting'),
      session('c', 'running'),
    ]);
    attention.sessions([
      session('a', 'idle'),
      session('b', 'idle'),
      session('c', 'idle'),
    ]);
    expect(os.badges).toEqual([2, 0]);
    expect(os.trays[0]).toEqual({
      tooltip: 'Datalayer: 2 waiting for you',
      labels: [
        'Datalayer: 2 waiting for you',
        'Open Session a',
        'Open Session b',
      ],
    });
    expect(os.trays[2]?.labels).toEqual(['Nothing waits for you']);
  });

  it('says an approval once, with the class and never the arguments, and a click shows it whole', async () => {
    const os = fakeOs();
    const attention = (await load())(os);
    const approval = {
      place: {
        kind: 'local' as const,
        folder: '/p',
        folderName: 'project',
        url: 'http://127.0.0.1:1',
      },
      id: 'a1',
      toolName: 'Run git push',
      args: { command: 'git push origin main' },
      agentId: 'default',
      requestedAt: '',
      app: 'The coding agent in project',
    };
    attention.approvals([approval]);
    attention.approvals([approval]);
    expect(os.banners.map(banner => banner.body)).toEqual([
      'The coding agent in project asks to Run git push (execute)',
    ]);
    expect(os.banners[0]?.body).not.toContain('origin main');
    os.banners[0]?.click();
    expect(os.focused).toEqual([{ approval }]);
    // Gone, then raised again under the same id: said again.
    attention.approvals([]);
    attention.approvals([approval]);
    expect(os.banners).toHaveLength(2);
  });
});
