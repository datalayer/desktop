/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The banner's rules (DESKTOP DK-13): which approvals belong to the chat in
 * front, how many wait, and what a decision came to — the main process's
 * sentence, shown as it is; none refused.
 */

import { describe, expect, it } from 'vitest';
import type { PendingApproval } from '../../../../shared/types/ipc.types';
import {
  approvalsForChat,
  decisionSaid,
  samePlace,
  waitingCount,
} from '../approvalsBanner';

const LOCAL = {
  kind: 'local' as const,
  folder: '/w/app',
  folderName: 'app',
  url: 'http://127.0.0.1:4321',
};

const pending: PendingApproval[] = [
  {
    place: LOCAL,
    id: 'ap-2',
    toolName: 'execute',
    args: { command: 'git push' },
    agentId: 'desktop-claude-code',
    requestedAt: '2026-10-21T10:00:02Z',
    app: 'The coding agent in app',
  },
  {
    place: LOCAL,
    id: 'ap-1',
    toolName: 'delete',
    args: { path: 'a.py' },
    agentId: 'desktop-claude-code',
    requestedAt: '2026-10-21T10:00:01Z',
    app: 'The coding agent in app',
  },
  {
    place: { kind: 'datalayer' },
    id: 'ap-3',
    toolName: 'send_mail',
    args: {},
    agentId: 'agent-1',
    requestedAt: '2026-10-21T10:00:03Z',
    app: 'Desk',
  },
  {
    place: {
      ...LOCAL,
      folder: '/w/other',
      folderName: 'other',
      url: 'http://127.0.0.1:5',
    },
    id: 'ap-4',
    toolName: 'execute',
    args: {},
    agentId: 'desktop-claude-code',
    requestedAt: '2026-10-21T10:00:04Z',
    app: 'The coding agent in other',
  },
];

describe('the banner', () => {
  it('shows the chat in front its place’s and agent’s approvals, oldest first, as the chat takes them', () => {
    const shown = approvalsForChat(pending, {
      place: LOCAL,
      agentId: 'desktop-claude-code',
    });
    expect(shown.map(a => a.id)).toEqual(['ap-1', 'ap-2']);
    expect(shown[1]).toEqual({
      id: 'ap-2',
      toolName: 'execute',
      args: { command: 'git push' },
      agentId: 'desktop-claude-code',
      requestedAt: '2026-10-21T10:00:02Z',
    });
  });

  it('shows a Datalayer chat only its place’s', () => {
    expect(
      approvalsForChat(pending, {
        place: { kind: 'datalayer' },
        agentId: 'agent-1',
      }).map(a => a.id)
    ).toEqual(['ap-3']);
    expect(
      approvalsForChat(pending, {
        place: { kind: 'datalayer' },
        agentId: 'other',
      })
    ).toEqual([]);
  });

  it('shows nothing with no chat in front, and counts what waits', () => {
    expect(approvalsForChat(pending, null)).toEqual([]);
    expect(waitingCount(pending)).toBe(4);
    expect(samePlace(LOCAL, { ...LOCAL })).toBe(true);
    expect(samePlace(LOCAL, { kind: 'datalayer' })).toBe(false);
  });

  it('says what a decision came to as the place said it, and refuses a decision said in no words', () => {
    expect(decisionSaid({ said: 'Approved git push (execute).' })).toBe(
      'Approved git push (execute).'
    );
    expect(
      decisionSaid({ said: 'This request was answered elsewhere already.' })
    ).toBe('This request was answered elsewhere already.');
    expect(() => decisionSaid({ said: '' })).toThrow(/no sentence/);
  });
});
