/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * The stub `loop` answers what the app's main process asks of a local
 * runtime (DESKTOP DK-15): its version, the port line, the health, the
 * harness catalogue, the sessions list with its filters, a session opened,
 * described, resumed, cloned, exported and imported, a turn answered as
 * AG-UI events, and an approval decided over its websocket. Run here as the
 * app will run it: spawned from `tests/mocks/loop`, on `PATH`.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

const LOOP = resolve(__dirname, 'loop');

/** The port the stub names on its first line that names one. */
function portOf(line: string): number | null {
  const picked = line.match(/free port (\d{2,5})\b/);
  return picked ? Number(picked[1]) : null;
}

describe('the stub loop', () => {
  let child: ChildProcess;
  let base = '';

  beforeAll(async () => {
    child = spawn(LOOP, ['serve', '--host', '127.0.0.1', '--port', '0'], {
      env: { ...process.env, AGENT_RUNTIMES_WORKSPACE_ROOT: '/tmp/a-folder' },
    });
    const port = await new Promise<number>((done, failed) => {
      let seen = '';
      const read = (chunk: Buffer) => {
        seen += chunk.toString();
        for (const line of seen.split('\n')) {
          const found = portOf(line);
          if (found) return done(found);
        }
      };
      child.stdout?.on('data', read);
      child.stderr?.on('data', read);
      child.on('exit', code =>
        failed(new Error(`the stub exited ${code}: ${seen}`))
      );
      setTimeout(() => failed(new Error(`no port line in: ${seen}`)), 8000);
    });
    base = `http://127.0.0.1:${port}`;
  }, 10000);

  afterAll(() => {
    child.kill('SIGTERM');
  });

  const get = async (path: string) => (await fetch(`${base}${path}`)).json();
  const post = async (path: string, body?: unknown) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it('says its version as loop does', () => {
    const answered = spawnSync(LOOP, ['--version'], { encoding: 'utf8' });
    expect(answered.status).toBe(0);
    expect(answered.stdout.trim()).toBe('agent_runtimes: 1.5.70');
    const older = spawnSync(LOOP, ['--version'], {
      encoding: 'utf8',
      env: { ...process.env, LOOP_STUB_VERSION: '1.5.60' },
    });
    expect(older.stdout.trim()).toBe('agent_runtimes: 1.5.60');
  });

  it('is healthy and serves the harness catalogue', async () => {
    expect(await get('/api/v1/health')).toMatchObject({
      status: 'healthy',
      service: 'agent-runtimes',
    });
    const catalogue = await get('/api/v1/harnesses');
    expect(catalogue.harnesses.map((h: { id: string }) => h.id)).toEqual([
      'claude-code',
      'fake',
    ]);
    expect(catalogue.harnesses[0]).toMatchObject({
      terms: { served_to_third_parties: 'api_key_only' },
      registered: { credential: 'ANTHROPIC_API_KEY' },
      instructions_file: 'CLAUDE.md',
    });
    const missing = await fetch(`${base}/api/v1/harnesses/nope`);
    expect(missing.status).toBe(404);
  });

  it('lists the planted sessions, filtered as the route is', async () => {
    const all = await get('/api/v1/apps/sessions');
    expect(all.has_more).toBe(false);
    expect(
      all.sessions.map((s: { uid: string; state: string }) => [s.uid, s.state])
    ).toEqual([
      ['stub00000001', 'paused'],
      ['stub00000002', 'ended'],
    ]);
    expect(
      (await get('/api/v1/apps/sessions?state=paused')).sessions
    ).toHaveLength(1);
    expect(
      (await get('/api/v1/apps/sessions?q=changelog')).sessions[0].uid
    ).toBe('stub00000002');
    expect(
      (await get('/api/v1/apps/sessions?held=true')).sessions
    ).toHaveLength(0);
    expect(
      (await fetch(`${base}/api/v1/apps/sessions?state=weird`)).status
    ).toBe(422);
  });

  it('describes a session with its folder, and its messages', async () => {
    const described = await get('/api/v1/apps/sessions/stub00000001');
    expect(described).toMatchObject({
      uid: 'stub00000001',
      harness: 'claude-code',
      turns: 2,
      harness_session: { harness: 'claude-code', workspace: '/tmp/a-folder' },
    });
    const thread = await get('/api/v1/apps/sessions/stub00000001/messages');
    expect(thread.messages.map((m: { role: string }) => m.role)).toEqual([
      'user',
      'assistant',
    ]);
  });

  it('opens a session, raises an approval, answers a turn and decides over the websocket', async () => {
    const opened = await post('/api/v1/apps/sessions', {
      agent: 'default',
      app: 'shield-mvp-claude-code',
    });
    const text = await opened.text();
    const session = JSON.parse(text.replace(/^data: /, '')).value;
    expect(session).toMatchObject({ state: 'open', held: true, turns: 0 });
    expect((await get('/api/v1/apps/sessions?held=true')).sessions[0].uid).toBe(
      session.uid
    );

    const run = await post('/api/v1/apps/agents/default/ag-ui/', {
      threadId: session.uid,
      messages: [{ id: 'm1', role: 'user', content: 'rename the helpers' }],
    });
    const events = (await run.text())
      .split('\n\n')
      .filter(Boolean)
      .map(line => JSON.parse(line.replace(/^data: /, '')));
    expect(events.map(e => e.type)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
    expect((await get(`/api/v1/apps/sessions/${session.uid}`)).turns).toBe(1);

    const socket = new WebSocket(
      `${base.replace('http', 'ws')}/api/v1/tool-approvals/ws`
    );
    const first = await new Promise<Record<string, unknown>>(done =>
      socket.once('message', raw => done(JSON.parse(String(raw))))
    );
    expect(first.type).toBe('agent.snapshot');
    const pending = (
      first.payload as {
        approvals: Array<{ id: string; status: string; tool_args: unknown }>;
      }
    ).approvals.filter(a => a.status === 'pending');
    expect(pending.map(a => a.id)).toEqual([`approval-${session.uid}`]);
    expect(pending[0].tool_args).toEqual({
      command: 'git push',
      _class: 'execute',
    });

    const next = new Promise<Record<string, unknown>>(done =>
      socket.once('message', raw => done(JSON.parse(String(raw))))
    );
    socket.send(
      JSON.stringify({
        type: 'tool_approval_decision',
        approvalId: pending[0].id,
        approved: false,
      })
    );
    const after = (await next).payload as { pendingApprovalCount: number };
    expect(after.pendingApprovalCount).toBe(0);
    expect((await get('/stub/decisions')).decisions).toEqual([
      { approvalId: pending[0].id, approved: false },
    ]);
    socket.close();
  });

  it('clones, exports and imports, and refuses what has ended', async () => {
    const clone = await (
      await post('/api/v1/apps/sessions/stub00000001/clone', { turn: 1 })
    ).json();
    expect(clone).toMatchObject({
      state: 'paused',
      turns: 1,
      lineage: { cloned_from: { uid: 'stub00000001', turn: 1 } },
    });
    const exported = await fetch(
      `${base}/api/v1/apps/sessions/stub00000001/export`
    );
    expect(exported.headers.get('content-disposition')).toContain(
      'stub00000001.session.jsonl'
    );
    const lines = (await exported.text()).trim().split('\n');
    expect(lines).toHaveLength(3);
    const imported = await fetch(`${base}/api/v1/apps/sessions/import`, {
      method: 'POST',
      body: lines.join('\n'),
    });
    expect(imported.status).toBe(201);
    expect(await imported.json()).toMatchObject({
      state: 'paused',
      lineage: { imported_from: { uid: 'stub00000001' } },
    });
    expect(
      (await post('/api/v1/apps/sessions/stub00000002/resume')).status
    ).toBe(409);
    const missing = await fetch(`${base}/api/v1/apps/sessions/import`, {
      method: 'POST',
      body: '{"kind":"session"}\n',
    });
    expect(missing.status).toBe(422);
  });
});
