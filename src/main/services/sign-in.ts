/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The provider sign-in (DESKTOP DK-03, decision D-2): *Sign in* opens
 * IAM's provider sign-in (GitHub, Google, LinkedIn, Okta — the
 * authorization URL `@datalayer/core`'s `oauth2` gives, with the callback
 * `datalayer://auth`, the contract VS Code's `oauthFlowManager.ts` uses) in
 * a small window of its own (`sign-in-window.ts`: its own partition, IAM's
 * page only). IAM's page then sends the browser to
 * `datalayer://auth?_xsrf=<state>&token=…`, which that window catches
 * (`will-navigate`) and hands here: the state is checked against the
 * sign-in started, the token kept in `safeStorage` through the SDK bridge
 * as a typed token is, the window closed. No protocol is registered with
 * the OS: the callback never leaves the app.
 *
 * The typed run URL and token of the Login page stay as the second way.
 * No renderer ever holds the token: the `datalayer:get-credentials` IPC is
 * gone, and this module hands the token to the SDK bridge only.
 *
 * `callbackOf`, `serverStateOf` and `loginUrlOf` are pure; `SignIn` holds
 * the one pending flow and takes its I/O as functions.
 *
 * @module main/services/sign-in
 */

import { randomBytes } from 'crypto';

/** The callback IAM sends the browser to, the scheme the phone's (O-4). */
export const SIGN_IN_CALLBACK = 'datalayer://auth';

/**
 * Whether a URL is the sign-in callback (`datalayer://auth…`).
 *
 * @param url - The URL asked for.
 *
 * @returns Whether it is.
 */
export function isSignInCallback(url: string): boolean {
  return url === SIGN_IN_CALLBACK || url.startsWith(`${SIGN_IN_CALLBACK}?`);
}

/** The providers IAM signs in with. */
export const SIGN_IN_PROVIDERS = [
  'github',
  'google',
  'linkedin',
  'okta',
] as const;

/** One of them. */
export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number];

/** A sign-in waits this long for the callback. */
export const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

/** The sentences a sign-in ends in. */
export const SIGN_IN_SENTENCES = {
  notTheCallback: 'This is not the sign-in callback.',
  noState: 'The sign-in callback named no state: start again.',
  noToken: 'The sign-in callback carried no token: start again.',
  noneStarted: 'No sign-in was started: start again.',
  mismatch:
    'The sign-in callback did not match the sign-in started: start again.',
  expired: 'The sign-in took more than five minutes: start again.',
  windowClosed:
    'The sign-in window was closed before it finished: start again.',
  noLoginUrl: 'Datalayer gave no sign-in page for this provider.',
  noServerState: "Datalayer's sign-in page names no state.",
  unknownProvider: (provider: string) =>
    `${provider} is not a sign-in provider: GitHub, Google, LinkedIn or Okta.`,
  refused: (error: string) => `Datalayer could not sign you in: ${error}`,
} as const;

/**
 * Whether a word names a provider.
 *
 * @param provider - The word.
 *
 * @returns Whether it does.
 */
export function isSignInProvider(
  provider: unknown
): provider is SignInProvider {
  return (
    typeof provider === 'string' &&
    (SIGN_IN_PROVIDERS as readonly string[]).includes(provider)
  );
}

/**
 * The login URL in IAM's answer (`loginURL`; the server has also spelled
 * it `authorization_url` and `autorization_url`).
 *
 * @param response - IAM's answer, parsed.
 *
 * @returns The URL, or null when there is none.
 */
export function loginUrlOf(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }
  const answer = response as Record<string, unknown>;
  for (const name of ['loginURL', 'authorization_url', 'autorization_url']) {
    const value = answer[name];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return null;
}

/**
 * The server's state in the authorization URL: IAM sets `state` to
 * `<nonce>:<callback>` and sends `_xsrf=<nonce>` back.
 *
 * @param loginUrl - The authorization URL.
 *
 * @returns The nonce, or null when the URL names none.
 */
export function serverStateOf(loginUrl: string): string | null {
  try {
    const state = new URL(loginUrl).searchParams.get('state') || '';
    const nonce = state.split(':')[0];
    return nonce || null;
  } catch {
    return null;
  }
}

/** What the callback said. */
export type SignInCallback =
  | { ok: true; token: string; state: string; user: string }
  | { ok: false; sentence: string };

/**
 * Reads the callback: `datalayer://auth?_xsrf=<state>&token=…` (IAM's
 * `_xsrf`, or `state` as the standard names it), or its error.
 *
 * @param url - The URL the sign-in window was sent to.
 *
 * @returns The token and state, or the sentence that refuses it.
 */
export function callbackOf(url: string): SignInCallback {
  if (url !== SIGN_IN_CALLBACK && !url.startsWith(`${SIGN_IN_CALLBACK}?`)) {
    return { ok: false, sentence: SIGN_IN_SENTENCES.notTheCallback };
  }
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return { ok: false, sentence: SIGN_IN_SENTENCES.notTheCallback };
  }
  const error = params.get('error');
  if (error) {
    return {
      ok: false,
      sentence: SIGN_IN_SENTENCES.refused(
        (params.get('error_description') || error).trim()
      ),
    };
  }
  const state = params.get('state') || params.get('_xsrf') || '';
  if (!state) {
    return { ok: false, sentence: SIGN_IN_SENTENCES.noState };
  }
  const token = params.get('token') || '';
  if (!token) {
    return { ok: false, sentence: SIGN_IN_SENTENCES.noToken };
  }
  return { ok: true, token, state, user: params.get('user') || '' };
}

/** The one sign-in in flight. */
export interface PendingSignIn {
  provider: SignInProvider;
  state: string;
  startedAt: number;
}

/** What `start` needs of the world. */
export interface StartDeps {
  /** IAM's authorization URL for a provider, a callback and a nonce. */
  authorizationUrl: (
    provider: SignInProvider,
    callbackUri: string,
    nonce: string
  ) => Promise<unknown>;
  /** Shows the URL in the sign-in window. */
  load: (url: string) => void;
  /** The clock. */
  now?: () => number;
}

/** What `callback` needs of the world. */
export interface CallbackDeps {
  /** Keeps the token (the SDK bridge's login: `safeStorage`). */
  keep: (token: string) => Promise<void>;
  /** The clock. */
  now?: () => number;
}

/** How a sign-in ended. */
export type SignInOutcome =
  { ok: true; provider: SignInProvider } | { ok: false; sentence: string };

/**
 * The sign-in: one pending flow at a time, the state checked once.
 */
export class SignIn {
  private pending: PendingSignIn | null = null;

  /** The flow in flight, for the tests and the log. */
  get inFlight(): PendingSignIn | null {
    return this.pending;
  }

  /**
   * Starts a sign-in: asks IAM for the provider's page with a fresh nonce,
   * remembers the server's state and shows the page in the sign-in window.
   *
   * @param provider - The provider.
   * @param deps - IAM, the window, the clock.
   *
   * @returns The login URL shown, or the sentence that refused.
   */
  async start(
    provider: unknown,
    deps: StartDeps
  ): Promise<{ ok: true; loginUrl: string } | { ok: false; sentence: string }> {
    if (!isSignInProvider(provider)) {
      return {
        ok: false,
        sentence: SIGN_IN_SENTENCES.unknownProvider(String(provider)),
      };
    }
    const nonce = randomBytes(32).toString('hex');
    let answer: unknown;
    try {
      answer = await deps.authorizationUrl(provider, SIGN_IN_CALLBACK, nonce);
    } catch (error) {
      return {
        ok: false,
        sentence: SIGN_IN_SENTENCES.refused(
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
    const loginUrl = loginUrlOf(answer);
    if (!loginUrl) {
      return { ok: false, sentence: SIGN_IN_SENTENCES.noLoginUrl };
    }
    const state = serverStateOf(loginUrl);
    if (!state) {
      return { ok: false, sentence: SIGN_IN_SENTENCES.noServerState };
    }
    this.pending = { provider, state, startedAt: (deps.now ?? Date.now)() };
    deps.load(loginUrl);
    return { ok: true, loginUrl };
  }

  /**
   * Takes the callback: the state must be the pending sign-in's and not
   * older than five minutes; then the token is kept.
   *
   * @param url - The callback URL the sign-in window caught.
   * @param deps - The keeper, the clock.
   *
   * @returns How it ended.
   */
  async callback(url: string, deps: CallbackDeps): Promise<SignInOutcome> {
    const read = callbackOf(url);
    const pending = this.pending;
    if (!read.ok) {
      if (read.sentence !== SIGN_IN_SENTENCES.notTheCallback) {
        this.pending = null;
      }
      return read;
    }
    if (!pending) {
      return { ok: false, sentence: SIGN_IN_SENTENCES.noneStarted };
    }
    this.pending = null;
    if (read.state !== pending.state) {
      return { ok: false, sentence: SIGN_IN_SENTENCES.mismatch };
    }
    if ((deps.now ?? Date.now)() - pending.startedAt > SIGN_IN_TIMEOUT_MS) {
      return { ok: false, sentence: SIGN_IN_SENTENCES.expired };
    }
    try {
      await deps.keep(read.token);
    } catch (error) {
      return {
        ok: false,
        sentence: SIGN_IN_SENTENCES.refused(
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
    return { ok: true, provider: pending.provider };
  }

  /** Forgets the pending sign-in (the person closed the page, or signed out). */
  cancel(): void {
    this.pending = null;
  }
}

/** The app's sign-in. */
export const signIn = new SignIn();
