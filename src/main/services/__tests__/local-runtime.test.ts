/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The local runtime (DESKTOP DK-05) and the harness check (DK-06) against
 * a stub `loop` (a Node script answering `--version`, printing its port,
 * serving `/health`, `/api/v1/harnesses` and the sessions): the refusals
 * (absent, too old) each naming the install line, the port read, the
 * environment handed (nothing beyond the declared names, the file store,
 * the folder as the workspace, the keychain's credential second), the
 * loopback origins the policy admits, the folders remembered, the last
 * folder's runtime at launch, the stop; the harness checked against the
 * machine with the keychain said.
 */

import { spawn } from 'child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/nowhere' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => Buffer.alloc(0),
    decryptString: () => '',
  },
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../datalayer-sdk-bridge', () => ({
  sdkBridge: { getConfig: () => ({}), isAuthenticated: () => false },
}));

const CLAUDE_CODE_SPEC = {
  id: 'claude-code',
  name: 'Claude Code',
  acp: { command: 'npx', args: [], load_session: true, modes: [] },
  requires: { secrets: ['ANTHROPIC_API_KEY'], binaries: ['node', 'git'] },
  registered: {
    adapter: '@agentclientprotocol/claude-agent-acp',
    version: '0.91.0',
    credential: "An Anthropic API key (ANTHROPIC_API_KEY), the person's own",
    binaries: 'Node 22 (engines.node >=22 on npm), git',
  },
  terms: { served_to_third_parties: 'api_key_only', licence: 'Apache-2.0' },
  capabilities: {
    resume: 'load',
    fork_history: 'replay',
    interrupt: true,
    steering: false,
    images: true,
    compaction: 'own',
  },
};

/**
 * The stub `loop`: `--version`, then `serve` on a free port, the Uvicorn
 * line, the routes. Its shebang is absolute, as a real `loop`'s is into its
 * venv: the trimmed environment hands no PATH that finds `node`.
 */
const STUB = `#!${process.execPath}
const http = require('http');
if (process.argv[2] === '--version') {
  console.log(process.env.STUB_LOOP_VERSION || 'Agent Runtimes Chat v1.5.70');
  process.exit(0);
}
if (process.argv[2] !== 'serve') {
  process.exit(2);
}
const server = http.createServer((request, response) => {
  const json = body => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  };
  if (request.url === '/health') return json({ status: 'ok' });
  if (request.url === '/env') return json({ env: process.env, cwd: process.cwd() });
  if (request.url === '/api/v1/harnesses') return json({ harnesses: ${JSON.stringify([CLAUDE_CODE_SPEC])} });
  if (request.url === '/api/v1/apps/sessions') return json({ sessions: [], has_more: false });
  response.statusCode = 404;
  response.end();
});
server.listen(0, '127.0.0.1', () => {
  console.log('INFO:     Uvicorn running on http://127.0.0.1:' + server.address().port + ' (Press CTRL+C to quit)');
});
process.on('SIGTERM', () => process.exit(0));
`;

describe('the local runtime', () => {
  let root: string;
  let userData: string;
  let folder: string;
  let loopPath: string;
  let kept: Record<string, string | undefined>;
  const logged: string[] = [];
  let runtimes: import('../local-runtime').LocalRuntimes;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'desktop-local-runtime-'));
    userData = join(root, 'userData');
    folder = join(root, 'project');
    mkdirSync(userData, { recursive: true });
    mkdirSync(folder, { recursive: true });
    loopPath = join(root, 'loop');
    writeFileSync(loopPath, STUB);
    chmodSync(loopPath, 0o755);
    kept = {};
    logged.length = 0;
    delete process.env.STUB_LOOP_VERSION;
    const { createLocalRuntimes, pathExists, runCommand } =
      await import('../local-runtime');
    runtimes = createLocalRuntimes({
      platform: 'linux',
      home: () => root,
      env: () => ({
        PATH: join(root, 'empty-bin'),
        HOME: root,
        AWS_SECRET_ACCESS_KEY: 'never',
        STUB_LOOP_VERSION: process.env.STUB_LOOP_VERSION,
      }),
      userData: () => userData,
      credentials: {
        get: name => kept[name],
        set: (name, value) => {
          kept[name] = value || undefined;
        },
        has: name => Boolean(kept[name]),
        file: () => '',
      },
      signedIn: () => null,
      spawn,
      run: async (command, args) =>
        command === 'node' || command === 'git'
          ? {
              ok: true,
              output:
                command === 'node' ? 'v22.11.0\n' : 'git version 2.43.0\n',
            }
          : runCommand(command, args),
      exists: pathExists,
      log: line => logged.push(line),
      fetch: (input, init) => fetch(input, init),
    });
  });

  afterEach(async () => {
    await runtimes.stop();
    rmSync(root, { recursive: true, force: true });
  });

  const configure = (settings: Record<string, unknown>): void => {
    writeFileSync(join(userData, 'settings.json'), JSON.stringify(settings));
  };

  it('refuses an absent loop in a sentence naming the install line, and a release too old', async () => {
    const absent = await runtimes.detect();
    expect(absent.ok).toBe(false);
    if (!absent.ok) {
      expect(absent.reason).toBe('absent');
      expect(absent.sentence).toContain(
        "uv tool install 'agent-runtimes[shield]'"
      );
      expect(absent.sentence).toContain("Desktop's settings");
    }
    await expect(runtimes.ensureRunning(folder)).rejects.toThrow(
      /was not found/
    );

    configure({ loopPath });
    process.env.STUB_LOOP_VERSION = 'agent_runtimes: 1.5.69';
    const old = await runtimes.detect();
    expect(old.ok).toBe(false);
    if (!old.ok) {
      expect(old.reason).toBe('too-old');
      expect(old.sentence).toContain('Datalayer Desktop needs 1.5.70 or later');
    }
    delete process.env.STUB_LOOP_VERSION;
    expect(await runtimes.detect()).toEqual({
      ok: true,
      path: loopPath,
      version: '1.5.70',
    });
  });

  it('starts loop serve per folder, reads its port, hands the trimmed environment with the file store, and admits it on loopback', async () => {
    configure({ loopPath });
    const changes: number[] = [];
    runtimes.onChange(() => changes.push(runtimes.list().length));
    const runtime = await runtimes.ensureRunning(folder);
    expect(runtime.url).toBe(`http://127.0.0.1:${runtime.port}`);
    expect(runtime.version).toBe('1.5.70');
    expect(runtime.folderName).toBe('project');
    expect(runtimes.list()).toHaveLength(1);
    expect(await runtimes.ensureRunning(folder)).toBe(runtime);
    expect(runtimes.connectSources()).toEqual([
      `http://127.0.0.1:${runtime.port}`,
      `ws://127.0.0.1:${runtime.port}`,
    ]);
    const { env, cwd } = (await (await fetch(`${runtime.url}/env`)).json()) as {
      env: Record<string, string>;
      cwd: string;
    };
    expect(cwd).toBe(folder);
    expect(env.AGENT_RUNTIMES_WORKSPACE_ROOT).toBe(folder);
    expect(env.AGENT_RUNTIMES_SESSION_STORE).toBe('file');
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.DATALAYER_API_KEY).toBeUndefined();
    // No catalogue read yet: no credential handed, said in the log.
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(runtime.credentials).toEqual({});
    expect(logged.join('\n')).toContain('no credential handed');
    expect(runtimes.folders()).toEqual({ folders: [folder], last: folder });
    await runtimes.stop(folder);
    expect(runtimes.list()).toEqual([]);
    expect(changes).toEqual([1, 0]);
    await expect(fetch(`${runtime.url}/health`)).rejects.toThrow();
  });

  it('hands the declared credential from the keychain once the catalogue is read, and says so', async () => {
    configure({ loopPath });
    kept.ANTHROPIC_API_KEY = 'sk-from-keychain';
    await runtimes.ensureRunning(folder);
    const harnesses = await runtimes.harnesses(folder);
    expect(harnesses.map(harness => harness.id)).toEqual(['claude-code']);
    await runtimes.stop(folder);
    const again = await runtimes.ensureRunning(folder);
    const { env } = (await (await fetch(`${again.url}/env`)).json()) as {
      env: Record<string, string>;
    };
    expect(env.ANTHROPIC_API_KEY).toBe('sk-from-keychain');
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(again.credentials).toEqual({ ANTHROPIC_API_KEY: 'secrets' });
    expect(logged.join('\n')).not.toContain('sk-from-keychain');
  });

  it('checks the harness against the machine: the adapter not pinned offered, the keychain said (DK-06)', async () => {
    configure({ loopPath });
    kept.ANTHROPIC_API_KEY = 'sk-from-keychain';
    await runtimes.ensureRunning(folder);
    const result = await runtimes.checkHarness('claude-code');
    expect(result.harness.name).toBe('Claude Code');
    expect(result.check.ok).toBe(true);
    expect(result.check.parts.map(part => part.part)).toEqual(['adapter']);
    expect(result.check.parts[0]?.setup).toBe(true);
    expect(result.check.setupCommand).toBe(
      'agent-shield setup --harness claude-code'
    );
    expect(result.credentialSaid).toBe(
      "ANTHROPIC_API_KEY is taken from the app's keychain."
    );
    kept.ANTHROPIC_API_KEY = undefined;
    const missing = await runtimes.checkHarness('claude-code');
    expect(missing.check.ok).toBe(false);
    expect(missing.check.parts.map(part => part.part)).toEqual([
      'adapter',
      'credential',
    ]);
    expect(missing.credentialSaid).toBe('');
    await expect(runtimes.checkHarness('gemini')).rejects.toThrow(
      /lists no harness gemini/
    );
  });

  it('starts the last folder remembered at launch (O-7), and nothing when none is', async () => {
    configure({ loopPath });
    expect(await runtimes.startLastFolder()).toBeNull();
    expect(logged.join('\n')).toContain('No folder remembered');
    const other = join(root, 'other');
    mkdirSync(other);
    runtimes.remember(folder);
    runtimes.remember(other);
    expect(runtimes.folders()).toEqual({
      folders: [other, folder],
      last: other,
    });
    const started = await runtimes.startLastFolder();
    expect(started?.folder).toBe(other);
    expect(runtimes.list().map(runtime => runtime.folder)).toEqual([other]);
    // A remembered folder that is gone is refused and logged, never thrown.
    await runtimes.stop();
    rmSync(other, { recursive: true, force: true });
    expect(await runtimes.startLastFolder()).toBeNull();
    expect(logged.join('\n')).toContain('is not a folder on this machine');
  });
});
