/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Waiting for you, the two sources in the main process (DESKTOP DK-13): a
 * local runtime's approvals read from its websocket's snapshots and decided
 * over it, the next snapshot confirming; Datalayer's polled at ai-agents,
 * read again before deciding, a 409 said as answered elsewhere, a 404
 * revealing nothing; a decision from the renderer reaching the right
 * source by its place.
 */

import { AddressInfo } from 'net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';

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
  sdkBridge: { getConfig: () => ({}), isAuthenticated: () => false },
}));

const snapshot = (approvals: unknown[]) =>
  JSON.stringify({
    version: '1.0',
    type: 'agent.snapshot',
    agentId: 'default',
    payload: {
      agentId: 'default',
      approvals,
      pendingApprovalCount: approvals.length,
    },
  });

const A1 = {
  id: 'a1',
  agent_id: 'default',
  tool_name: 'Run git push',
  tool_args: { command: 'git push', _class: 'execute' },
  status: 'pending',
  created_at: '2026-10-21T10:00:00Z',
};

const settle = () => new Promise(resolve => setTimeout(resolve, 60));

describe('the approvals', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it('reads a local runtime over its websocket, decides over it, and confirms by the next snapshot', async () => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    cleanups.push(() => server.close());
    const received: unknown[] = [];
    let urlAsked = '';
    server.on('connection', (socket, request) => {
      urlAsked = request.url ?? '';
      socket.send(snapshot([A1]));
      socket.on('message', raw => {
        const message = JSON.parse(String(raw)) as { approvalId: string };
        received.push(message);
        socket.send(snapshot([]));
      });
    });
    await new Promise(resolve => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    const runtime = {
      folder: '/home/ada/project',
      folderName: 'project',
      url: `http://127.0.0.1:${port}`,
      port,
      version: '1.5.70',
      credentials: {},
    };
    const { createApprovals } = await import('../approvals');
    const changes: number[] = [];
    const approvals = createApprovals({
      runtimes: () => [runtime],
      onRuntimesChange: () => () => undefined,
      signedIn: () => null,
      fetch: vi.fn() as unknown as typeof fetch,
      socket: url => new WebSocket(url),
      log: vi.fn(),
      pollMs: 60_000,
    });
    cleanups.push(() => approvals.stop());
    approvals.onChange(pending => changes.push(pending.length));
    approvals.start();
    await settle();
    expect(urlAsked).toBe('/api/v1/tool-approvals/ws?agent_id=default');
    const [pending] = approvals.pending();
    expect(pending).toMatchObject({
      place: { kind: 'local', url: runtime.url, folderName: 'project' },
      id: 'a1',
      toolName: 'Run git push',
      app: 'The coding agent in project',
    });
    const { said } = await approvals.decide({
      place: {
        kind: 'local',
        folder: runtime.folder,
        folderName: 'project',
        url: runtime.url,
      },
      id: 'a1',
      decision: 'approve',
    });
    expect(said).toBe('Approved: Run git push.');
    expect(received).toEqual([
      { type: 'tool_approval_decision', approvalId: 'a1', approved: true },
    ]);
    expect(approvals.pending()).toEqual([]);
    expect(changes).toEqual([1, 0]);
    // Not pending when asked: answered elsewhere.
    expect(
      (
        await approvals.decide({
          place: {
            kind: 'local',
            folder: runtime.folder,
            folderName: 'project',
            url: runtime.url,
          },
          id: 'a1',
          decision: 'reject',
        })
      ).said
    ).toBe('This approval was answered elsewhere.');
  });

  it('polls Datalayer while signed in, reads again before deciding, says a 409 and reveals nothing of a 404', async () => {
    const calls: Array<{
      url: string;
      method: string;
      authorization?: string;
    }> = [];
    let readAgain: { status: number; body: unknown } = {
      status: 200,
      body: { approval: { id: 'd1', status: 'pending' } },
    };
    const fetchFake = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url,
        method: init?.method ?? 'GET',
        authorization: headers.Authorization,
      });
      if (url.includes('/tool-approvals?status=pending')) {
        return new Response(
          JSON.stringify({
            approvals: [
              {
                id: 'd1',
                agent_id: 'desk',
                tool_name: 'send_email',
                tool_args: { to: 'ada@example.com' },
                status: 'pending',
                created_at: '2026-10-21T10:00:00Z',
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.endsWith('/tool-approvals/d1')) {
        return new Response(JSON.stringify(readAgain.body), {
          status: readAgain.status,
        });
      }
      if (url.endsWith('/approve') || url.endsWith('/reject')) {
        return new Response('{}', { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch;
    const { createApprovals } = await import('../approvals');
    const approvals = createApprovals({
      runtimes: () => [],
      onRuntimesChange: () => () => undefined,
      signedIn: () => ({
        token: 'jwt',
        aiAgentsUrl: 'https://r1.datalayer.run/',
      }),
      fetch: fetchFake,
      socket: () => {
        throw new Error('no local runtime');
      },
      log: vi.fn(),
      pollMs: 20,
    });
    cleanups.push(() => approvals.stop());
    approvals.start();
    await settle();
    expect(calls[0]?.url).toBe(
      'https://r1.datalayer.run/api/ai-agents/v1/tool-approvals?status=pending&limit=200'
    );
    expect(calls[0]?.authorization).toBe('Bearer jwt');
    expect(calls.length).toBeGreaterThan(1);
    expect(approvals.pending()).toMatchObject([
      {
        place: { kind: 'datalayer' },
        id: 'd1',
        toolName: 'send_email',
        agentId: 'desk',
      },
    ]);
    const approved = await approvals.decide({
      place: { kind: 'datalayer' },
      id: 'd1',
      decision: 'approve',
    });
    expect(approved.said).toBe('Approved: Send email.');
    const decidedCall = calls.find(call => call.method === 'POST');
    expect(decidedCall?.url).toBe(
      'https://r1.datalayer.run/api/ai-agents/v1/tool-approvals/d1/approve'
    );
    expect(decidedCall?.authorization).toBe('Bearer jwt');

    readAgain = {
      status: 200,
      body: { approval: { id: 'd1', status: 'approved' } },
    };
    expect(
      (
        await approvals.decide({
          place: { kind: 'datalayer' },
          id: 'd1',
          decision: 'reject',
        })
      ).said
    ).toBe('This approval was answered elsewhere.');

    readAgain = { status: 404, body: { detail: 'Not found' } };
    const gone = await approvals.decide({
      place: { kind: 'datalayer' },
      id: 'd1',
      decision: 'reject',
    });
    expect(gone.said).toBe('This approval is no longer waiting.');
    expect(gone.said).not.toContain('email');
  });
});
