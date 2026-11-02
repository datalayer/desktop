/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * Sign-in (DESKTOP DK-03): the callback parsed (the state, a missing token
 * refused in a sentence, IAM's error said), the server's state read from
 * the authorization URL, the flow — started with a fresh nonce and the
 * callback `datalayer://auth`, the token kept once the state matches, a
 * mismatch, a stale flow and a second callback refused — and the preload
 * exposing no credentials call.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  SIGN_IN_CALLBACK,
  SIGN_IN_SENTENCES,
  SIGN_IN_TIMEOUT_MS,
  SignIn,
  callbackOf,
  isSignInProvider,
  loginUrlOf,
  serverStateOf,
} from '../sign-in';

describe('callbackOf', () => {
  it('reads IAM’s callback: the token, the state as _xsrf or state, the user', () => {
    expect(callbackOf('datalayer://auth?_xsrf=abc&user=ada&token=tok')).toEqual(
      { ok: true, token: 'tok', state: 'abc', user: 'ada' }
    );
    expect(callbackOf('datalayer://auth?state=abc&token=tok')).toEqual({
      ok: true,
      token: 'tok',
      state: 'abc',
      user: '',
    });
  });

  it('refuses a missing token, a missing state, an error and anything that is not the callback', () => {
    expect(callbackOf('datalayer://auth?_xsrf=abc')).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.noToken,
    });
    expect(callbackOf('datalayer://auth?token=tok')).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.noState,
    });
    expect(
      callbackOf(
        'datalayer://auth?_xsrf=abc&provider=github&error=access_denied'
      )
    ).toEqual({
      ok: false,
      sentence: 'Datalayer could not sign you in: access_denied',
    });
    expect(
      callbackOf(
        'datalayer://auth?_xsrf=abc&error=x&error_description=The%20person%20declined'
      )
    ).toEqual({
      ok: false,
      sentence: 'Datalayer could not sign you in: The person declined',
    });
    expect(callbackOf('https://datalayer.ai/auth?token=tok&state=abc')).toEqual(
      { ok: false, sentence: SIGN_IN_SENTENCES.notTheCallback }
    );
    expect(callbackOf('datalayer://sessions/abc')).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.notTheCallback,
    });
  });
});

describe('serverStateOf and loginUrlOf', () => {
  it('reads the nonce before the colon in the state of the authorization URL', () => {
    expect(
      serverStateOf(
        'https://github.com/login/oauth/authorize?client_id=x&state=nonce1%3Adatalayer%3A%2F%2Fauth'
      )
    ).toBe('nonce1');
    expect(
      serverStateOf(
        'https://github.com/login/oauth/authorize?state=nonce1:datalayer://auth'
      )
    ).toBe('nonce1');
    expect(
      serverStateOf('https://github.com/login/oauth/authorize')
    ).toBeNull();
    expect(serverStateOf('not a url')).toBeNull();
  });

  it('takes the login URL under the three names IAM has used', () => {
    expect(loginUrlOf({ loginURL: 'https://a' })).toBe('https://a');
    expect(loginUrlOf({ authorization_url: 'https://b' })).toBe('https://b');
    expect(loginUrlOf({ autorization_url: 'https://c' })).toBe('https://c');
    expect(loginUrlOf({ success: true })).toBeNull();
    expect(loginUrlOf(null)).toBeNull();
  });

  it('knows the providers', () => {
    expect(isSignInProvider('github')).toBe(true);
    expect(isSignInProvider('okta')).toBe(true);
    expect(isSignInProvider('bluesky')).toBe(false);
    expect(isSignInProvider(1)).toBe(false);
  });
});

describe('SignIn', () => {
  const authorizationUrl = vi.fn(
    async (provider: string, callback: string, nonce: string) => ({
      success: true,
      loginURL: `https://iam.example/provider/${provider}?state=server-${nonce.slice(0, 6)}:${encodeURIComponent(callback)}`,
    })
  );

  const started = async (now = () => 1000) => {
    const flow = new SignIn();
    const load = vi.fn();
    const answer = await flow.start('github', { authorizationUrl, load, now });
    return { flow, load, answer };
  };

  it('asks IAM with the datalayer://auth callback and a fresh nonce, remembers the server’s state and shows the page', async () => {
    const { flow, load, answer } = await started();
    expect(answer.ok).toBe(true);
    const [provider, callback, nonce] = authorizationUrl.mock.calls.at(-1)!;
    expect(provider).toBe('github');
    expect(callback).toBe(SIGN_IN_CALLBACK);
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(flow.inFlight).toMatchObject({
      provider: 'github',
      state: `server-${nonce.slice(0, 6)}`,
      startedAt: 1000,
    });
    expect(load).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://iam.example/provider/github?state=server-'
      )
    );
    const second = await new SignIn().start('github', {
      authorizationUrl,
      load,
    });
    expect(authorizationUrl.mock.calls.at(-1)![2]).not.toBe(nonce);
    expect(second.ok).toBe(true);
  });

  it('refuses a provider it does not know, an IAM that answers no page, a page with no state', async () => {
    const load = vi.fn();
    expect(
      await new SignIn().start('bluesky', { authorizationUrl, load })
    ).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.unknownProvider('bluesky'),
    });
    expect(
      await new SignIn().start('google', {
        authorizationUrl: async () => ({ success: false }),
        load,
      })
    ).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.noLoginUrl,
    });
    expect(
      await new SignIn().start('google', {
        authorizationUrl: async () => ({ loginURL: 'https://iam.example/x' }),
        load,
      })
    ).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.noServerState,
    });
    expect(
      await new SignIn().start('google', {
        authorizationUrl: async () => {
          throw new Error(
            "OAuth2 provider 'google' not found or not configured"
          );
        },
        load,
      })
    ).toEqual({
      ok: false,
      sentence:
        "Datalayer could not sign you in: OAuth2 provider 'google' not found or not configured",
    });
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the token once the callback’s state is the sign-in’s, and only once', async () => {
    const { flow } = await started();
    const state = flow.inFlight!.state;
    const keep = vi.fn(async () => undefined);
    const outcome = await flow.callback(
      `datalayer://auth?_xsrf=${state}&user=ada&token=the-token`,
      { keep, now: () => 2000 }
    );
    expect(outcome).toEqual({ ok: true, provider: 'github' });
    expect(keep).toHaveBeenCalledWith('the-token');
    expect(flow.inFlight).toBeNull();
    const again = await flow.callback(
      `datalayer://auth?_xsrf=${state}&token=the-token`,
      { keep }
    );
    expect(again).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.noneStarted,
    });
    expect(keep).toHaveBeenCalledTimes(1);
  });

  it('refuses a state that is not the sign-in’s, a callback after five minutes, and says what the keeper refused', async () => {
    const keep = vi.fn(async () => undefined);
    const { flow } = await started();
    expect(
      await flow.callback('datalayer://auth?_xsrf=someone-elses&token=t', {
        keep,
      })
    ).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.mismatch,
    });
    expect(flow.inFlight).toBeNull();
    const stale = await started(() => 1000);
    const late = 1000 + SIGN_IN_TIMEOUT_MS + 1;
    expect(
      await stale.flow.callback(
        `datalayer://auth?_xsrf=${stale.flow.inFlight!.state}&token=t`,
        { keep, now: () => late }
      )
    ).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.expired,
    });
    const refused = await started();
    expect(
      await refused.flow.callback(
        `datalayer://auth?_xsrf=${refused.flow.inFlight!.state}&token=t`,
        {
          keep: async () => {
            throw new Error('Invalid token: 401');
          },
          now: () => 2000,
        }
      )
    ).toEqual({
      ok: false,
      sentence: 'Datalayer could not sign you in: Invalid token: 401',
    });
    expect(keep).not.toHaveBeenCalled();
  });

  it('a missing token in the callback ends the sign-in in its sentence', async () => {
    const { flow } = await started();
    const keep = vi.fn(async () => undefined);
    expect(
      await flow.callback(`datalayer://auth?_xsrf=${flow.inFlight!.state}`, {
        keep,
      })
    ).toEqual({
      ok: false,
      sentence: SIGN_IN_SENTENCES.noToken,
    });
    expect(flow.inFlight).toBeNull();
    expect(keep).not.toHaveBeenCalled();
  });
});

describe('the token reaches no renderer', () => {
  it('the preload exposes no credentials call and the main process answers none', () => {
    const preload = readFileSync(
      resolve(__dirname, '../../../preload/index.ts'),
      'utf8'
    );
    const main = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8');
    expect(preload).not.toContain('get-credentials');
    expect(preload).not.toContain('getCredentials');
    expect(main).not.toContain('get-credentials');
  });
});
