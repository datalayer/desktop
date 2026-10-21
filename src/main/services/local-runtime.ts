/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The local runtime (DESKTOP DK-05) and the harness on the machine (DK-06),
 * the main process's side.
 *
 * The app finds `loop` on the person's machine (a path set in the app's
 * settings first, then `PATH`, then `uv tool`'s and `pipx`'s bins) with
 * agent-runtimes at 1.5.70 or later, and starts `loop serve --host
 * 127.0.0.1 --port 0` as a child process **per folder** (decisions D-10,
 * D-12: never VS Code's or a terminal's runtime), its port read from the
 * first line that names one, its output in the app's log. The environment
 * handed is `portable/localRuntime.ts`'s, the same as VS Code's: the
 * trimmed set, the credentials the harness specs declare by name (the
 * environment first, the app's keychain second — never anything
 * undeclared), the folder as the workspace, `AGENT_RUNTIMES_SESSION_STORE=
 * file`, and the person's token and IAM when signed in. Missing `loop`, a
 * release too old or Python absent is refused in a sentence naming
 * `uv tool install 'agent-runtimes[shield]'` — never bundled (D-4).
 *
 * The runtime of the last folder worked in starts at launch (D-11, O-7), so
 * the list of this machine's sessions is read; the last ten folders are
 * remembered in a JSON file under the app's user data folder (not
 * `electron-store`: its release 10 is ESM-only and the main bundle is CJS).
 *
 * The pure parts — the candidate paths, the version floor, the port line,
 * the environment, the harness check — are agent-runtimes'
 * `portable/localRuntime.ts` (DK-25); this module does the I/O.
 *
 * @module main/services/local-runtime
 */

import { type ChildProcess, execFile, spawn } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { basename, dirname, join } from 'path';
import * as readline from 'readline';
import { app } from 'electron';
import log from 'electron-log/main';
import {
  candidateLoopPaths,
  credentialSourceSaid,
  DESKTOP_HOST,
  type HarnessCheck,
  harnessCheck,
  type HarnessFacts,
  harnessesOf,
  type HarnessMachine,
  loopbackSourcesOf,
  LOOP_SERVE_ARGUMENTS,
  type LoopDetection,
  type LoopRefusalReason,
  loopDetection,
  portOf,
  runtimeEnvironment,
  shieldPrefixOf,
} from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import { DESKTOP_SETTINGS_FILE } from '../../shared/appChat';
import type {
  HarnessCheckResult,
  LocalRuntimeInfo,
  RememberedFolders,
} from '../../shared/types/ipc.types';
import { credentials as keychain, type Credentials } from './credentials';
import { sdkBridge } from './datalayer-sdk-bridge';

/** The file under the app's user data folder that remembers the folders worked in. */
export const FOLDERS_FILE = 'sessions-folders.json';

/** How many folders are remembered. */
export const REMEMBERED_FOLDERS = 10;

/** How long the runtime has to name its port and answer `/health`. */
const START_TIMEOUT_MS = 90_000;

/** How long a command (`loop --version`, `node --version`) has. */
const COMMAND_TIMEOUT_MS = 30_000;

/** The local runtime is not started: the sentence says why and what to do. */
export class LocalRuntimeRefused extends Error {
  /**
   * @param reason - Why.
   * @param sentence - The sentence shown.
   */
  constructor(
    public readonly reason: LoopRefusalReason | 'failed',
    sentence: string
  ) {
    super(sentence);
    this.name = 'LocalRuntimeRefused';
  }
}

/** A local runtime running for one folder. */
export interface LocalRuntime extends LocalRuntimeInfo {
  pid: number;
  loopPath: string;
}

/** What the service reads from the machine and the app, so the tests give their own. */
export interface LocalRuntimeDeps {
  platform: string;
  home: () => string;
  env: () => Record<string, string | undefined>;
  /** The folder the remembered folders and the settings live in. */
  userData: () => string;
  /** The app's keychain. */
  credentials: Credentials;
  /** The person's token and IAM when signed in; null otherwise. */
  signedIn: () => { token: string; iamUrl: string } | null;
  /** Spawns a process. */
  spawn: typeof spawn;
  /** Runs a command to completion: stdout and stderr together. */
  run: (
    command: string,
    args: string[]
  ) => Promise<{ ok: boolean; output: string }>;
  exists: (path: string) => Promise<boolean>;
  log: (line: string) => void;
  /** Reaches a local runtime over loopback: `fetch`. */
  fetch: typeof fetch;
}

interface Running {
  runtime: LocalRuntime;
  child: ChildProcess;
}

/** The service. */
export interface LocalRuntimes {
  /** Finds `loop` and judges it: the configured path, `PATH`, uv tool's and pipx's bins. */
  detect(): Promise<LoopDetection>;
  /** The folder's runtime, started when it is not running; the folder remembered. */
  ensureRunning(folder: string): Promise<LocalRuntime>;
  /** Stops a folder's runtime, or every runtime. */
  stop(folder?: string): Promise<void>;
  /** The runtimes running now. */
  list(): LocalRuntime[];
  /** The runtimes as the renderer sees them. */
  infos(): LocalRuntimeInfo[];
  /** The runtime of a folder, when one runs. */
  runtimeOf(folder: string): LocalRuntime | undefined;
  /** What the window's `connect-src` admits on loopback: each running runtime, http and ws, nothing else. */
  connectSources(): string[];
  /** The folders remembered, the last first. */
  folders(): RememberedFolders;
  /** Remembers a folder as the last worked in. */
  remember(folder: string): void;
  /** At launch (O-7): the last folder's runtime, when one is remembered; its refusal logged, never thrown. */
  startLastFolder(): Promise<LocalRuntime | null>;
  /** The harness catalogue from a running runtime's `GET /api/v1/harnesses`. */
  harnesses(folder?: string): Promise<HarnessFacts[]>;
  /** What the machine has for a harness, judged (DK-06). */
  checkHarness(id: string, folder?: string): Promise<HarnessCheckResult>;
  /** Fires when a runtime starts or stops. */
  onChange(listener: () => void): () => void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The service over its dependencies.
 *
 * @param deps - The machine and the app.
 *
 * @returns The service.
 */
export function createLocalRuntimes(deps: LocalRuntimeDeps): LocalRuntimes {
  const running = new Map<string, Running>();
  const starting = new Map<string, Promise<LocalRuntime>>();
  const listeners = new Set<() => void>();
  let harnessCache: HarnessFacts[] | null = null;

  const fire = (): void => {
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        deps.log(`A listener failed: ${message(error)}`);
      }
    }
  };

  const settings = (): { loopPath: string } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        readFileSync(join(deps.userData(), DESKTOP_SETTINGS_FILE), 'utf8')
      );
    } catch {
      parsed = undefined;
    }
    const loopPath =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>).loopPath
        : undefined;
    return { loopPath: typeof loopPath === 'string' ? loopPath : '' };
  };

  const foldersFile = (): string => join(deps.userData(), FOLDERS_FILE);

  const folders = (): RememberedFolders => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(foldersFile(), 'utf8'));
    } catch {
      return { folders: [], last: null };
    }
    const list =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>).folders
        : undefined;
    const kept = Array.isArray(list)
      ? list.filter(
          (item): item is string => typeof item === 'string' && item.length > 0
        )
      : [];
    return {
      folders: kept.slice(0, REMEMBERED_FOLDERS),
      last: kept[0] ?? null,
    };
  };

  const remember = (folder: string): void => {
    const kept = [
      folder,
      ...folders().folders.filter(item => item !== folder),
    ].slice(0, REMEMBERED_FOLDERS);
    const path = foldersFile();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ folders: kept }, null, 2));
  };

  const detect = async (): Promise<LoopDetection> => {
    const candidates = candidateLoopPaths({
      platform: deps.platform,
      home: deps.home(),
      pathVariable: deps.env().PATH,
      configured: settings().loopPath,
    });
    let found: string | null = null;
    for (const candidate of candidates) {
      if (await deps.exists(candidate)) {
        found = candidate;
        break;
      }
    }
    if (!found) {
      return loopDetection(null, DESKTOP_HOST);
    }
    const answer = await deps.run(found, ['--version']);
    return loopDetection(
      {
        path: found,
        versionOutput: answer.ok ? answer.output : null,
        failure: answer.ok ? undefined : answer.output,
      },
      DESKTOP_HOST
    );
  };

  const list = (): LocalRuntime[] =>
    [...running.values()].map(entry => entry.runtime);

  const runtimeOf = (folder: string): LocalRuntime | undefined =>
    running.get(folder)?.runtime;

  const readHarnesses = async (url: string): Promise<HarnessFacts[]> => {
    const response = await deps.fetch(`${url}/api/v1/harnesses`);
    if (!response.ok) {
      throw new LocalRuntimeRefused(
        'failed',
        `The local runtime at ${url} answered ${response.status} for /api/v1/harnesses: it is older than 1.5.70 — update it with \`uv tool install 'agent-runtimes[shield]'\`.`
      );
    }
    harnessCache = harnessesOf(await response.json());
    return harnessCache;
  };

  const harnesses = async (folder?: string): Promise<HarnessFacts[]> => {
    const runtime = folder ? runtimeOf(folder) : list()[0];
    if (runtime) {
      return readHarnesses(runtime.url);
    }
    if (harnessCache) {
      return harnessCache;
    }
    throw new LocalRuntimeRefused(
      'failed',
      'No local runtime is running to list the harnesses: File → Work in a folder… starts one.'
    );
  };

  const portOfChild = (
    child: ChildProcess,
    folderName: string
  ): Promise<number> =>
    new Promise<number>((resolve, reject) => {
      const lastLines: string[] = [];
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          void terminate(child);
          reject(
            new LocalRuntimeRefused(
              'failed',
              `The local runtime of ${folderName} did not say its port within ${START_TIMEOUT_MS / 1000} s: its output is in the app's log.`
            )
          );
        }
      }, START_TIMEOUT_MS);
      const onLine = (line: string): void => {
        deps.log(`[${folderName}] ${line}`);
        lastLines.push(line);
        if (lastLines.length > 5) {
          lastLines.shift();
        }
        const port = settled ? null : portOf(line);
        if (port !== null) {
          settled = true;
          clearTimeout(timer);
          resolve(port);
        }
      };
      for (const stream of [child.stdout, child.stderr]) {
        if (stream) {
          readline.createInterface({ input: stream }).on('line', onLine);
        }
      }
      child.on('error', error => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(
            new LocalRuntimeRefused(
              'failed',
              `The local runtime of ${folderName} could not start: ${error.message}`
            )
          );
        }
      });
      child.on('exit', (code, signal) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(
            new LocalRuntimeRefused(
              'failed',
              `The local runtime of ${folderName} exited (${signal ?? code}) before it said its port: ${lastLines.join(' | ') || 'nothing was written'}.`
            )
          );
        }
      });
    });

  const awaitHealth = async (
    url: string,
    child: ChildProcess,
    folderName: string
  ): Promise<void> => {
    const until = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < until) {
      if (child.exitCode !== null) {
        throw new LocalRuntimeRefused(
          'failed',
          `The local runtime of ${folderName} exited (${child.exitCode}) before it answered /health.`
        );
      }
      try {
        const response = await deps.fetch(`${url}/health`);
        if (response.ok) {
          return;
        }
      } catch {
        // Not up yet.
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    await terminate(child);
    throw new LocalRuntimeRefused(
      'failed',
      `The local runtime of ${folderName} did not answer /health at ${url} within ${START_TIMEOUT_MS / 1000} s.`
    );
  };

  const start = async (folder: string): Promise<LocalRuntime> => {
    const folderName = basename(folder) || folder;
    if (!(await deps.exists(folder))) {
      throw new LocalRuntimeRefused(
        'failed',
        `${folder} is not a folder on this machine: pick another with File → Work in a folder….`
      );
    }
    const detection = await detect();
    if (!detection.ok) {
      throw new LocalRuntimeRefused(detection.reason, detection.sentence);
    }
    // The credentials handed are the ones the catalogue declares: read
    // from the last runtime that answered, else from none (said in the log)
    // — the first runtime of a launch starts without, and the harness
    // check (DK-06) reads the catalogue from it before a session starts.
    const declared = new Set<string>();
    for (const harness of harnessCache ?? []) {
      for (const name of harness.secrets) {
        declared.add(name);
      }
    }
    if (declared.size === 0) {
      deps.log(
        `No harness catalogue read yet: the runtime of ${folderName} starts with no credential handed.`
      );
    }
    const secrets: Record<string, string | undefined> = {};
    for (const name of declared) {
      secrets[name] = deps.credentials.get(name);
    }
    const signedIn = deps.signedIn();
    const { environment, credentials } = runtimeEnvironment({
      host: deps.env(),
      folder,
      declared: [...declared],
      secrets,
      signedIn: signedIn ?? undefined,
      sessionsPath: deps.env().AGENT_RUNTIMES_SESSIONS_PATH,
    });
    deps.log(
      `Starting \`loop ${LOOP_SERVE_ARGUMENTS.join(' ')}\` (${detection.path}, agent-runtimes ${detection.version}) in ${folder}` +
        (signedIn ? ', signed in' : ', signed out') +
        `; credentials handed: ${Object.keys(credentials).join(', ') || 'none'}.`
    );
    const child = deps.spawn(detection.path, [...LOOP_SERVE_ARGUMENTS], {
      cwd: folder,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: deps.platform === 'win32' && /\.cmd$/i.test(detection.path),
    });
    const port = await portOfChild(child, folderName);
    const url = `http://127.0.0.1:${port}`;
    await awaitHealth(url, child, folderName);
    const runtime: LocalRuntime = {
      folder,
      folderName,
      url,
      port,
      version: detection.version,
      credentials,
      pid: child.pid ?? 0,
      loopPath: detection.path,
    };
    running.set(folder, { runtime, child });
    child.on('exit', (code, signal) => {
      const entry = running.get(folder);
      if (entry && entry.child === child) {
        running.delete(folder);
        deps.log(
          `The local runtime of ${folderName} exited (${signal ?? code}).`
        );
        fire();
      }
    });
    deps.log(
      `The local runtime of ${folderName} is at ${url} (pid ${runtime.pid}).`
    );
    remember(folder);
    fire();
    return runtime;
  };

  const ensureRunning = async (folder: string): Promise<LocalRuntime> => {
    const already = running.get(folder);
    if (already) {
      remember(folder);
      return already.runtime;
    }
    const pending = starting.get(folder);
    if (pending) {
      return pending;
    }
    const started = start(folder).finally(() => starting.delete(folder));
    starting.set(folder, started);
    return started;
  };

  const stop = async (folder?: string): Promise<void> => {
    const keys = folder ? [folder] : [...running.keys()];
    let stopped = false;
    for (const key of keys) {
      const entry = running.get(key);
      if (!entry) {
        continue;
      }
      running.delete(key);
      stopped = true;
      deps.log(
        `Stopping the local runtime of ${entry.runtime.folderName} (pid ${entry.runtime.pid}).`
      );
      await terminate(entry.child);
    }
    if (stopped) {
      fire();
    }
  };

  const machineOf = async (facts: HarnessFacts): Promise<HarnessMachine> => {
    const binaries: Record<string, string | null> = {};
    for (const binary of facts.binaries) {
      const answer = await deps.run(binary, ['--version']);
      binaries[binary] = answer.ok ? answer.output.trim() : null;
    }
    const secrets: Record<string, string | undefined> = {};
    for (const name of facts.secrets) {
      secrets[name] = deps.credentials.get(name);
    }
    const env = deps.env();
    return {
      binaries,
      environment: env,
      secrets,
      adapterInstalled: await deps.exists(shieldPrefixOf(deps.home(), facts)),
      subscriptionLogin:
        facts.id === 'claude-code' &&
        !env.ANTHROPIC_API_KEY &&
        !secrets.ANTHROPIC_API_KEY &&
        (Boolean(env.CLAUDE_CODE_OAUTH_TOKEN) ||
          (await deps.exists(
            join(deps.home(), '.claude', '.credentials.json')
          ))),
    };
  };

  const checkHarness = async (
    id: string,
    folder?: string
  ): Promise<HarnessCheckResult> => {
    const facts = (await harnesses(folder)).find(harness => harness.id === id);
    if (!facts) {
      throw new LocalRuntimeRefused(
        'failed',
        `The local runtime lists no harness ${id}: pick one of its catalogue.`
      );
    }
    const check: HarnessCheck = harnessCheck(
      facts,
      await machineOf(facts),
      DESKTOP_HOST
    );
    const [first] = facts.secrets;
    const credentialSaid =
      check.credentialSource && first
        ? credentialSourceSaid(first, check.credentialSource, DESKTOP_HOST)
        : '';
    return { harness: facts, check, credentialSaid };
  };

  return {
    detect,
    ensureRunning,
    stop,
    list,
    infos: () =>
      list().map(({ folder, folderName, url, port, version, credentials }) => ({
        folder,
        folderName,
        url,
        port,
        version,
        credentials,
      })),
    runtimeOf,
    connectSources: () =>
      list().flatMap(runtime => loopbackSourcesOf(runtime.port)),
    folders,
    remember,
    async startLastFolder() {
      const { last } = folders();
      if (!last) {
        deps.log('No folder remembered: no local runtime at launch.');
        return null;
      }
      try {
        return await ensureRunning(last);
      } catch (error) {
        deps.log(`The last folder's runtime did not start: ${message(error)}`);
        return null;
      }
    },
    harnesses,
    checkHarness,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

async function terminate(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise<void>(resolve => {
    const hard = setTimeout(() => {
      child.kill('SIGKILL');
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(hard);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

/**
 * Runs a command to completion, stdout and stderr together.
 *
 * @param command - The executable.
 * @param args - Its arguments.
 *
 * @returns Whether it exited 0, and what it wrote.
 */
export function runCommand(
  command: string,
  args: string[]
): Promise<{ ok: boolean; output: string }> {
  return new Promise(resolve => {
    execFile(
      command,
      args,
      {
        timeout: COMMAND_TIMEOUT_MS,
        env: { ...process.env, NO_COLOR: '1' },
        shell: process.platform === 'win32',
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const output = `${stdout}${stderr ? `\n${stderr}` : ''}`;
        resolve({
          ok: !error,
          output: error && !output.trim() ? error.message : output,
        });
      }
    );
  });
}

/** Whether a path exists. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/** The app's service: the machine, the keychain, the sign-in the SDK bridge holds. */
export const localRuntimes: LocalRuntimes = createLocalRuntimes({
  platform: process.platform,
  home: () => homedir(),
  env: () => process.env,
  userData: () => app.getPath('userData'),
  credentials: keychain,
  signedIn: () => {
    const config = sdkBridge.getConfig();
    return sdkBridge.isAuthenticated() && config.token && config.iamUrl
      ? { token: config.token, iamUrl: config.iamUrl }
      : null;
  },
  spawn,
  run: runCommand,
  exists: pathExists,
  log: line => log.info(`[LocalRuntime] ${line}`),
  fetch: (input, init) => fetch(input, init),
});

/** Whether a local runtime runs — for the menu's *Stop the local runtime* (DK-04). */
export function anyLocalRuntime(): boolean {
  return localRuntimes.list().length > 0;
}
