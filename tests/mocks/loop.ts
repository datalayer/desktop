/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * A stand-in for `loop` in the desktop suite (DESKTOP DK-15): no Python,
 * no model, no key. Run as `node tests/mocks/loop.ts` (Node 22 strips the
 * types; `tests/mocks/loop` is the wrapper a `PATH` entry points at).
 *
 * It answers `--version` (`agent_runtimes: 1.5.70`, `LOOP_STUB_VERSION`
 * to say another), and `serve --host 127.0.0.1 --port 0` prints the lines
 * the real command prints (`Auto-selected free port N`, `Uvicorn running on
 * http://127.0.0.1:N`) and serves what the app's main process and tests call:
 *
 * - `GET /api/v1/health`;
 * - `GET /api/v1/harnesses` (the catalogue: Claude Code and a fake harness);
 * - `GET /api/v1/apps`, `POST /api/v1/apps/configure`;
 * - `GET|POST /api/v1/apps/sessions` with the rows `loop sessions list`
 *   prints (state, turn, agent, harness, turns, title, lineage, `held`),
 *   filtered as the route is (`?state=`, `?agent=`, `?app=`, `?q=`,
 *   `?archived=`, `?held=`), and by uid: `GET`, `/messages`, `/resume`,
 *   `/stop`, `/end`, `/clone`, `/export`, `/import`, `/agent` (swap),
 *   `/title`, `/archived` — a session's folder on `GET /sessions/{uid}` as
 *   `harness_session.workspace` (DK-26's seam answers it on the list later);
 * - `POST /api/v1/apps/agents/{agent}/ag-ui/`: one turn answered by the
 *   fake harness as AG-UI events, a diff display on the second turn;
 * - the approvals websocket `/api/v1/tool-approvals/ws`: `agent.snapshot`
 *   out, `tool_approval_decision` in (VS-07 as built); one approval raised
 *   per session opened, `git push`, pending until decided;
 * - `GET /stub/decisions` and `POST /stub/sessions` (the suite's own
 *   back door: the decisions taken, a session planted).
 *
 * Shapes follow `routes/apps.py`, `routes/harnesses.py` and
 * `routes/tool_approvals.py` of agent-runtimes 1.5.70 and VS Code's stub
 * (`src/test/fixtures/stub-loop`). Anything else is a 404 in a sentence.
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer, type WebSocket } from 'ws';

const VERSION = process.env.LOOP_STUB_VERSION || '1.5.70';
const args = process.argv.slice(2);

type Row = Record<string, unknown>;

const CATALOGUE = {
  harnesses: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      acp: {
        command: 'npx',
        args: ['-y', '@agentclientprotocol/claude-agent-acp@0.91.0'],
        load_session: true,
        modes: ['default', 'plan'],
      },
      requires: { secrets: ['ANTHROPIC_API_KEY'], binaries: ['node', 'git'] },
      terms: {
        served_to_third_parties: 'api_key_only',
        licence:
          'Apache-2.0 (adapter); Anthropic Commercial Terms of Service (the agent)',
      },
      registered: {
        adapter: '@agentclientprotocol/claude-agent-acp',
        version: '0.91.0',
        credential: 'ANTHROPIC_API_KEY',
        binaries: 'Node 22, git',
      },
      capabilities: {
        resume: 'load',
        fork_history: 'replay',
        interrupt: true,
        steering: false,
        images: true,
        compaction: 'own',
      },
      instructions_file: 'CLAUDE.md',
      contributed_by: 'agent-runtimes',
    },
    {
      id: 'fake',
      name: 'Fake harness',
      acp: {
        command: 'python3',
        args: ['acp_fake_agent.py'],
        load_session: false,
        modes: [],
      },
      requires: { secrets: [], binaries: [] },
      terms: { served_to_third_parties: 'permitted', licence: 'BSD-3-Clause' },
      registered: {
        adapter: '',
        version: '',
        credential: 'none',
        binaries: '',
      },
      capabilities: {
        resume: 'replay',
        fork_history: 'replay',
        interrupt: true,
        steering: false,
        images: false,
        compaction: 'none',
      },
      instructions_file: 'AGENTS.md',
      contributed_by: 'agent-shield',
    },
  ],
};

/** The blank harness application the catalogue's examples configure. */
const BLANK_APP = {
  id: 'shield-mvp-claude-code',
  version: '0.1.0',
  name: 'Shield MVP (Claude Code)',
  kind: 'harness',
};

/**
 * The sessions the file store holds when the stub starts: one paused in a
 * folder, one ended — what the Sessions page lists before anything is
 * opened. `LOOP_STUB_SESSIONS` names a JSON file with other rows.
 */
function plantedSessions(): Row[] {
  const file = process.env.LOOP_STUB_SESSIONS;
  if (file) {
    return JSON.parse(readFileSync(file, 'utf8')) as Row[];
  }
  const workspace =
    process.env.AGENT_RUNTIMES_WORKSPACE_ROOT || '/home/person/project';
  return [
    sessionRow({
      uid: 'stub00000001',
      state: 'paused',
      agent: 'default',
      app: BLANK_APP,
      title: 'Rename the helpers',
      turns: 2,
      harness: 'claude-code',
      workspace,
      started_at: '2026-10-20T09:00:00Z',
    }),
    sessionRow({
      uid: 'stub00000002',
      state: 'ended',
      agent: 'default',
      app: BLANK_APP,
      title: 'Add the changelog',
      turns: 1,
      harness: 'claude-code',
      workspace,
      started_at: '2026-10-19T15:30:00Z',
    }),
  ];
}

/** One row as `GET /api/v1/apps/sessions` prints it (`describe()`). */
function sessionRow(given: {
  uid: string;
  state: string;
  agent: string;
  app: Row;
  title: string;
  turns: number;
  harness: string | null;
  workspace?: string;
  started_at?: string;
  lineage?: Row;
}): Row {
  return {
    uid: given.uid,
    agent: given.agent,
    app: { ...given.app },
    instance: { app_uid: '', deployment_uid: '', version: 0 },
    preview: true,
    acts_as: { kind: 'person', uid: 'person-1' },
    opened_by: { kind: 'person', uid: 'person-1' },
    user: null,
    state: given.state,
    turn: 'idle',
    held: given.state === 'open',
    harness: given.harness,
    title: given.title,
    archived: false,
    lineage: given.lineage ?? { cloned_from: null, imported_from: null },
    runs_on: null,
    settings: {},
    profile: null,
    asking: null,
    actions: [],
    files: [],
    python: false,
    turns: given.turns,
    started_at: given.started_at ?? new Date().toISOString(),
    resumed: false,
    workspace: given.workspace ?? null,
  };
}

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    })
  );
}

function body(request: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let text = '';
    request.setEncoding('utf8');
    request.on('data', chunk => (text += chunk));
    request.on('end', () => resolve(text));
  });
}

function serve(): Promise<void> {
  const sessions: Row[] = plantedSessions();
  const messages = new Map<string, Row[]>();
  for (const session of sessions) {
    messages.set(String(session.uid), [
      { id: `${session.uid}-u1`, role: 'user', content: 'Hello from the stub' },
      {
        id: `${session.uid}-a1`,
        role: 'assistant',
        content: 'The stub answers.',
      },
    ]);
  }
  const configured: Row[] = [BLANK_APP];
  const approvals: Row[] = [];
  const decisions: Row[] = [];
  const sockets = new Set<WebSocket>();
  let counter = sessions.length;

  const snapshot = () => ({
    version: '1.0',
    type: 'agent.snapshot',
    agentId: 'default',
    payload: {
      agentId: 'default',
      approvals: approvals.map(approval => ({ ...approval })),
      pendingApprovalCount: approvals.filter(a => a.status === 'pending')
        .length,
    },
  });
  const pushSnapshot = () => {
    const message = JSON.stringify(snapshot());
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(message);
    }
  };
  const raise = (uid: string) => {
    approvals.push({
      id: `approval-${uid}`,
      agent_id: 'default',
      tool_name: 'Run git push',
      tool_call_id: `call-${uid}`,
      tool_args: { command: 'git push', _class: 'execute' },
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    pushSnapshot();
  };
  const find = (uid: string) => sessions.find(s => s.uid === uid);
  const newUid = () => `stub${String(++counter).padStart(8, '0')}`;

  const server = createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const json = (status: number, value: unknown) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(value));
      };
      const method = request.method || 'GET';
      const path = url.pathname;

      if (method === 'GET' && path === '/api/v1/health') {
        return json(200, {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'agent-runtimes',
          version: VERSION,
        });
      }
      if (method === 'GET' && path === '/api/v1/harnesses')
        return json(200, CATALOGUE);
      const oneHarness = path.match(/^\/api\/v1\/harnesses\/([^/]+)$/);
      if (method === 'GET' && oneHarness) {
        const found = CATALOGUE.harnesses.find(h => h.id === oneHarness[1]);
        return found
          ? json(200, found)
          : json(404, {
              detail: `There is no harness named '${oneHarness[1]}' on this runtime: GET /api/v1/harnesses lists them.`,
            });
      }
      if (method === 'GET' && path === '/api/v1/apps')
        return json(200, { apps: configured });
      if (method === 'POST' && path === '/api/v1/apps/configure') {
        const asked = JSON.parse((await body(request)) || '{}');
        if (!asked.app || asked.app.schema !== 'loop.app/v1') {
          return json(422, {
            detail: {
              problems: [
                'The application is not an Appspec (schema loop.app/v1).',
              ],
            },
          });
        }
        const app = {
          id: asked.app.id,
          version: asked.app.version,
          name: asked.app.name,
          kind: asked.app.kind || 'harness',
        };
        if (!configured.some(c => c.id === app.id)) configured.push(app);
        return json(200, { agent_id: 'default', app: { id: app.id } });
      }

      if (method === 'POST' && path === '/api/v1/apps/sessions') {
        const asked = JSON.parse((await body(request)) || '{}');
        const app = configured.find(c => c.id === asked.app) || configured[0];
        if (!app)
          return json(404, {
            detail: `There is no agent ${asked.agent} on this runtime.`,
          });
        const uid = newUid();
        const session = sessionRow({
          uid,
          state: 'open',
          agent: asked.agent || 'default',
          app,
          title: String(app.name),
          turns: 0,
          harness: 'claude-code',
          workspace: process.env.AGENT_RUNTIMES_WORKSPACE_ROOT,
        });
        sessions.push(session);
        messages.set(uid, []);
        raise(uid);
        response.writeHead(200, { 'Content-Type': 'text/event-stream' });
        response.write(
          `data: ${JSON.stringify({ type: 'CUSTOM', name: 'loop.session', value: session })}\n\n`
        );
        response.end();
        return;
      }
      if (method === 'GET' && path === '/api/v1/apps/sessions') {
        const want = (name: string) => url.searchParams.get(name) || '';
        const state = want('state');
        if (state && !['open', 'paused', 'ended'].includes(state)) {
          return json(422, {
            detail: `'${state}' is not a session state: open, paused or ended.`,
          });
        }
        const archived = want('archived') === 'true';
        const held = want('held') === 'true';
        const listed = sessions.filter(
          s =>
            (!want('agent') || s.agent === want('agent')) &&
            (!state || s.state === state) &&
            (!want('app') || (s.app as Row).id === want('app')) &&
            (!want('q') ||
              String(s.title)
                .toLowerCase()
                .includes(want('q').toLowerCase())) &&
            (archived || !s.archived) &&
            (!held || s.held)
        );
        const limit = Math.max(1, Math.min(Number(want('limit')) || 50, 200));
        return json(200, {
          sessions: listed.slice(0, limit),
          has_more: listed.length > limit,
        });
      }
      if (method === 'POST' && path === '/api/v1/apps/sessions/import') {
        const text = await body(request);
        const lines = text
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line) as Row);
        const head = lines[0] || {};
        if (!head.agent && !url.searchParams.get('agent')) {
          return json(422, {
            detail: 'The file names no agent: say ?agent= to import it.',
          });
        }
        const uid = newUid();
        const session = sessionRow({
          uid,
          state: 'paused',
          agent: String(url.searchParams.get('agent') || head.agent),
          app: (head.app as Row) || configured[0],
          title: String(head.title || 'Imported session'),
          turns: lines.filter(l => l.role === 'user').length,
          harness: 'claude-code',
          lineage: {
            cloned_from: null,
            imported_from: {
              uid: String(head.uid || ''),
              at: new Date().toISOString(),
            },
          },
        });
        sessions.push(session);
        messages.set(
          uid,
          lines.filter(l => l.role === 'user' || l.role === 'assistant')
        );
        return json(201, session);
      }

      const byUid = path.match(
        /^\/api\/v1\/apps\/sessions\/([^/]+)(?:\/([a-z]+))?$/
      );
      if (byUid) {
        const [, uid, verb] = byUid;
        const session = find(uid);
        if (!session)
          return json(404, { detail: `No session ${uid} is held here.` });
        if (method === 'GET' && !verb) {
          return json(200, {
            ...session,
            harness_session: session.harness
              ? {
                  harness: session.harness,
                  vendor_session_id: `vendor-${uid}`,
                  workspace: session.workspace,
                }
              : null,
          });
        }
        if (method === 'GET' && verb === 'messages')
          return json(200, { messages: messages.get(uid) || [] });
        if (method === 'GET' && verb === 'export') {
          const lines = [
            {
              kind: 'session',
              uid,
              agent: session.agent,
              app: session.app,
              title: session.title,
              harness: session.harness,
            },
            ...(messages.get(uid) || []),
          ];
          response.writeHead(200, {
            'Content-Type': 'application/x-ndjson',
            'Content-Disposition': `attachment; filename="${uid}.session.jsonl"`,
          });
          response.end(
            lines.map(line => JSON.stringify(line)).join('\n') + '\n'
          );
          return;
        }
        if (
          method === 'POST' &&
          session.state === 'ended' &&
          ['resume', 'stop', 'agent', 'clone'].includes(verb || '')
        ) {
          return json(409, {
            detail: `Session ${uid} has ended: nothing runs in it any more.`,
          });
        }
        if (method === 'POST' && verb === 'resume') {
          Object.assign(session, { state: 'open', held: true, resumed: true });
          return json(200, session);
        }
        if (method === 'POST' && verb === 'stop') {
          Object.assign(session, {
            state: 'paused',
            held: false,
            turn: 'idle',
          });
          return json(200, session);
        }
        if (method === 'POST' && verb === 'end') {
          Object.assign(session, { state: 'ended', held: false, turn: 'idle' });
          return json(200, session);
        }
        if (method === 'POST' && verb === 'clone') {
          const asked = JSON.parse((await body(request)) || '{}');
          const at = Number(asked.turn ?? session.turns);
          const clone = sessionRow({
            uid: newUid(),
            state: 'paused',
            agent: String(session.agent),
            app: session.app as Row,
            title: String(session.title),
            turns: at,
            harness: session.harness as string | null,
            workspace: session.workspace as string | undefined,
            lineage: { cloned_from: { uid, turn: at }, imported_from: null },
          });
          sessions.push(clone);
          messages.set(
            String(clone.uid),
            (messages.get(uid) || []).slice(0, at * 2)
          );
          return json(201, clone);
        }
        if (method === 'POST' && verb === 'agent') {
          const asked = JSON.parse((await body(request)) || '{}');
          if (!asked.agent)
            return json(422, {
              detail: 'Say which agent the session swaps to.',
            });
          const said = `You take over from ${session.agent}: the conversation so far is above, continue it.`;
          session.agent = asked.agent;
          (messages.get(uid) || []).push({
            id: `${uid}-swap`,
            role: 'assistant',
            content: said,
          });
          return json(200, { ...session, said });
        }
        if (method === 'PUT' && verb === 'title') {
          const asked = JSON.parse((await body(request)) || '{}');
          session.title =
            String(asked.title || '').slice(0, 200) || session.title;
          return json(200, session);
        }
        if (method === 'PUT' && verb === 'archived') {
          const asked = JSON.parse((await body(request)) || '{}');
          session.archived = Boolean(asked.archived);
          return json(200, session);
        }
      }

      const run = path.match(/^\/api\/v1\/apps\/agents\/([^/]+)\/ag-ui\/?$/);
      if (method === 'POST' && run) {
        const asked = JSON.parse((await body(request)) || '{}');
        const threadId = String(asked.threadId || asked.thread_id || '');
        const runId = String(asked.runId || `run-${Date.now()}`);
        const given = Array.isArray(asked.messages)
          ? (asked.messages as Row[])
          : [];
        const last = [...given].reverse().find(m => m.role === 'user');
        const session = find(threadId);
        const thread = messages.get(threadId) || [];
        if (last)
          thread.push({
            id: String(last.id || `${threadId}-u${thread.length}`),
            role: 'user',
            content: String(last.content || ''),
          });
        const turn = session ? Number(session.turns) + 1 : 1;
        if (session) Object.assign(session, { turns: turn, turn: 'idle' });
        const messageId = `${threadId || 'thread'}-a${turn}`;
        const answer = `The fake harness heard: ${String(last?.content || '')}`;
        thread.push({ id: messageId, role: 'assistant', content: answer });
        messages.set(threadId, thread);
        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        });
        const send = (event: Row) =>
          response.write(`data: ${JSON.stringify(event)}\n\n`);
        send({ type: 'RUN_STARTED', threadId, runId });
        send({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' });
        send({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta: answer });
        send({ type: 'TEXT_MESSAGE_END', messageId });
        if (turn >= 2) {
          // The second turn edits a file: the diff display the chat draws (SHIELD §4.3).
          send({
            type: 'CUSTOM',
            name: 'loop.display',
            value: {
              kind: 'diff',
              path: 'README.md',
              language: 'markdown',
              before: '# Project\n',
              after: '# Project\n\nEdited by the fake harness.\n',
            },
          });
        }
        send({ type: 'RUN_FINISHED', threadId, runId });
        response.end();
        return;
      }

      if (method === 'GET' && path === '/stub/decisions')
        return json(200, { decisions });
      if (method === 'POST' && path === '/stub/sessions') {
        const asked = JSON.parse((await body(request)) || '{}') as Row;
        const uid = String(asked.uid || newUid());
        const row = sessionRow({
          uid,
          state: String(asked.state || 'paused'),
          agent: String(asked.agent || 'default'),
          app: (asked.app as Row) || BLANK_APP,
          title: String(asked.title || 'Planted session'),
          turns: Number(asked.turns || 0),
          harness: (asked.harness as string | null) ?? 'claude-code',
          workspace: asked.workspace as string | undefined,
        });
        sessions.push(row);
        messages.set(uid, []);
        return json(201, row);
      }
      json(404, { detail: `The stub loop does not serve ${method} ${path}.` });
    }
  );

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/api/v1/tool-approvals/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      sockets.add(ws);
      ws.send(JSON.stringify(snapshot()));
      ws.on('message', raw => {
        let message: Row;
        try {
          message = JSON.parse(String(raw));
        } catch {
          return;
        }
        if (
          message.type === 'tool_approval_decision' &&
          typeof message.approvalId === 'string' &&
          typeof message.approved === 'boolean'
        ) {
          const approval = approvals.find(a => a.id === message.approvalId);
          if (approval && approval.status === 'pending') {
            approval.status = message.approved ? 'approved' : 'rejected';
            decisions.push({
              approvalId: message.approvalId,
              approved: message.approved,
            });
          }
          pushSnapshot();
        } else if (message.type === 'request_snapshot') {
          ws.send(JSON.stringify(snapshot()));
        }
      });
      ws.on('close', () => sockets.delete(ws));
    });
  });

  return listen(server).then(port => {
    console.log(`Auto-selected free port ${port}`);
    console.log(
      `Uvicorn running on http://127.0.0.1:${port} (Press CTRL+C to quit)`
    );
    const stop = () => {
      for (const socket of sockets) socket.close();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 500).unref();
    };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  });
}

if (args[0] === '--version') {
  console.log(`agent_runtimes: ${VERSION}`);
  process.exit(0);
} else if (args[0] === 'serve') {
  serve();
} else {
  console.error(
    `The stub loop knows --version and serve; not: ${args.join(' ')}`
  );
  process.exit(2);
}
