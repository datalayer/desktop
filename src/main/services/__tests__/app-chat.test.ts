/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The deployments a session on Datalayer picks from (STUDIO A-20, DESKTOP
 * DK-08): the main process lists them with the token it holds, one not
 * kept always on closed with why, and lends the token to the chats'
 * prefixes once. The `agentChatEnabled` flag of 0.0.5 is gone (O-1).
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  userData: '',
  onBeforeSendHeaders: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => electron.userData },
  session: {
    defaultSession: {
      webRequest: { onBeforeSendHeaders: electron.onBeforeSendHeaders },
    },
  },
}));

vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@datalayer/core/lib/config/planes', () => ({
  DEFAULT_PLANE_URLS: {
    aiAgentsUrl: 'https://r1.datalayer.run',
    spacerUrl: 'https://prod1.datalayer.run',
  },
}));

vi.mock('../datalayer-sdk-bridge', () => ({
  sdkBridge: {
    getConfig: () => ({
      token: 'person-token',
      iamUrl: 'https://prod1.datalayer.run',
      runtimesUrl: 'https://r1.datalayer.run',
      spacerUrl: 'https://prod1.datalayer.run',
    }),
    isAuthenticated: () => true,
  },
}));

/** The service, fresh: the setting is read once per launch. */
const load = async () => {
  vi.resetModules();
  return import('../app-chat');
};

describe('the deployments listed', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    electron.userData = mkdtempSync(join(tmpdir(), 'desktop-settings-'));
    electron.onBeforeSendHeaders.mockReset();
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        deployments: [
          {
            uid: 'dep-1',
            app_name: 'Support Desk',
            state: 'live',
            version: 2,
            always_on: false,
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(electron.userData, { recursive: true, force: true });
  });

  it('on, lists the deployments; one not kept always on is closed, saying why', async () => {
    const chat = await load();
    chat.lendTokenToAppChats();
    chat.lendTokenToAppChats();
    expect(electron.onBeforeSendHeaders).toHaveBeenCalledTimes(1);

    const listed = await chat.listAppChatDeployments();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'https://r1.datalayer.run/'
    );
    expect(listed.deployments).toEqual([
      {
        kind: 'closed',
        uid: 'dep-1',
        name: 'Support Desk',
        why: 'Support Desk is not kept always on, so no runtime holds its agent: turn on Always on in its Ship tab to talk to it here.',
      },
    ]);
  });
});
