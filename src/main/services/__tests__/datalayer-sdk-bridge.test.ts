/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * The stored token at launch: cleared only when IAM refuses it, kept when
 * IAM does not answer, and checked again when the window next asks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { files, whoami, setToken, config } = vi.hoisted(() => {
  const config: { token: string; iamUrl: string } = { token: '', iamUrl: '' };
  return {
    files: new Map<string, string>(),
    whoami: vi.fn(),
    setToken: vi.fn(async (token: string) => {
      config.token = token;
    }),
    config,
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => '/user-data' },
  safeStorage: { isEncryptionAvailable: () => false },
}));
vi.mock('electron-log', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('fs', () => ({
  existsSync: (path: string) => files.has(path),
  readFileSync: (path: string) => files.get(path),
  writeFileSync: (path: string, data: string) => files.set(path, data),
  unlinkSync: (path: string) => files.delete(path),
}));
vi.mock('@datalayer/agent-runtimes/lib/client/AgentRuntimesClient', () => ({
  AgentRuntimesClient: class {
    setToken = setToken;
    whoami = whoami;
    getConfig = () => config;
  },
}));

import { DatalayerSDKBridge, isTokenRefused } from '../datalayer-sdk-bridge';

const TOKEN_PATH = '/user-data/.datalayer-token';
const user = { toJSON: () => ({ email: 'a@b.c', handle: 'a' }) };

function refused(status: number): Error {
  return Object.assign(new Error(`Invalid response: ${status}`), {
    response: { status },
  });
}

beforeEach(() => {
  files.clear();
  files.set(TOKEN_PATH, `FALLBACK:${Buffer.from('kept').toString('base64')}`);
  whoami.mockReset();
  setToken.mockClear();
  config.token = '';
});

describe('isTokenRefused', () => {
  it('is a refusal for an expired token, a 401 and a 403 only', () => {
    expect(
      isTokenRefused(
        Object.assign(new Error('x'), { name: 'TokenExpiredError' })
      )
    ).toBe(true);
    expect(isTokenRefused(refused(401))).toBe(true);
    expect(isTokenRefused(refused(403))).toBe(true);
    expect(isTokenRefused(refused(503))).toBe(false);
    expect(isTokenRefused(new TypeError('fetch failed'))).toBe(false);
    expect(isTokenRefused(undefined)).toBe(false);
  });
});

describe('restoring the stored token at launch', () => {
  it('clears it when IAM refuses it', async () => {
    whoami.mockRejectedValueOnce(refused(401));
    const bridge = new DatalayerSDKBridge();
    await bridge.initialize();
    expect(files.has(TOKEN_PATH)).toBe(false);
    expect(config.token).toBe('');
    expect(bridge.isAuthenticated()).toBe(false);
  });

  it('keeps it when IAM does not answer, and signs in on the next ask', async () => {
    whoami.mockRejectedValueOnce(new TypeError('fetch failed'));
    const bridge = new DatalayerSDKBridge();
    await bridge.initialize();
    expect(files.has(TOKEN_PATH)).toBe(true);
    expect(bridge.isAuthenticated()).toBe(false);

    whoami.mockResolvedValueOnce(user);
    await bridge.retryRestore();
    expect(bridge.isAuthenticated()).toBe(true);
    expect(bridge.getAuthState().user).toEqual({ email: 'a@b.c', handle: 'a' });

    // Signed in, a further ask checks nothing.
    await bridge.retryRestore();
    expect(whoami).toHaveBeenCalledTimes(2);
  });
});
