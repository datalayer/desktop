/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * Apps' calls in the main process (DESKTOP DK-02): each signed with
 * the token this process holds, none made signed out, the routes asked,
 * the change sent for one exact version, a refusal said with the
 * service's detail.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../datalayer-sdk-bridge', () => ({
  sdkBridge: { isAuthenticated: () => false, getConfig: () => ({}) },
}));
vi.mock('../app-chat', () => ({
  servicesOf: () => ({ aiAgentsUrl: '', spacerUrl: '' }),
}));
vi.mock('../../app/environment', () => ({ isDevelopment: () => false }));

import { APPS_SIGNED_OUT, appsCalls } from '../apps';

const SERVICES = {
  aiAgentsUrl: 'https://agents.example',
  spacerUrl: 'https://spacer.example',
};

function world(answers: Array<{ status: number; body: unknown }>) {
  const asked: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    asked.push({ url, init });
    const answer = answers.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return {
    asked,
    calls: appsCalls({
      token: () => 'tok',
      services: () => SERVICES,
      landing: () => 'https://datalayer.ai',
      fetch: fetch as unknown as typeof globalThis.fetch,
    }),
  };
}

describe('appsCalls', () => {
  it('lists the applications with the token, and says where Apps on the web is', async () => {
    const { asked, calls } = world([
      { status: 200, body: { items: [{ uid: 'u1', name_t: 'Desk' }] } },
    ]);
    const listed = await calls.list();
    expect(listed.landing).toBe('https://datalayer.ai');
    expect(listed.apps.map(app => app.uid)).toEqual(['u1']);
    expect(asked[0].url).toBe(
      'https://spacer.example/api/spacer/v1/spaces/items/types/app'
    );
    expect(
      (asked[0].init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tok');
  });

  it('asks nothing signed out', async () => {
    const fetch = vi.fn();
    const calls = appsCalls({
      token: () => null,
      services: () => SERVICES,
      landing: () => '',
      fetch,
    });
    await expect(calls.deployments()).rejects.toThrow(APPS_SIGNED_OUT);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('pauses one exact version and reads the deployment answered', async () => {
    const { asked, calls } = world([
      {
        status: 200,
        body: {
          deployment: { uid: 'd1', app_uid: 'u1', version: 3, state: 'paused' },
        },
      },
    ]);
    const changed = await calls.setState({
      uid: 'd1',
      version: 3,
      state: 'paused',
    });
    expect(changed).toMatchObject({ uid: 'd1', state: 'paused', version: 3 });
    expect(asked[0].url).toBe(
      'https://agents.example/api/ai-agents/v1/apps/deployments/d1'
    );
    expect(asked[0].init?.method).toBe('PATCH');
    expect(JSON.parse(String(asked[0].init?.body))).toEqual({
      version: 3,
      state: 'paused',
    });
  });

  it('says a refusal with the service’s detail', async () => {
    const { calls } = world([
      { status: 409, body: { detail: 'Version 3 is not the one deployed.' } },
    ]);
    await expect(
      calls.setState({ uid: 'd1', version: 3, state: 'live' })
    ).rejects.toThrow(
      'The deployment could not be resumed: Version 3 is not the one deployed.'
    );
  });
});
