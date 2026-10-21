/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Sign-in with a handle and a password: the pair is exchanged with IAM
 * (`POST <runUrl>/api/iam/v1/login`) for a token, which then signs in as a
 * typed token does. The password is never kept nor logged.
 *
 * @module main/services/password-login
 */

/** The Run URL used when the form sends none. */
export const DEFAULT_RUN_URL = 'https://prod1.datalayer.run';

/** What the renderer sends over `datalayer:login-password`. */
export interface PasswordLogin {
  runUrl?: string;
  handle?: string;
  password?: string;
}

/**
 * Exchange a handle and a password for an IAM token.
 *
 * @param login - The Run URL, the handle and the password.
 * @param fetchImpl - The fetch to use (the global one by default).
 * @returns The token IAM answered with.
 * @throws A sentence: IAM's own message when it gives one.
 */
export async function exchangePasswordForToken(
  { runUrl, handle, password }: PasswordLogin,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (!handle || !password) {
    throw new Error('Both your handle and your password are needed.');
  }
  const base = String(runUrl || DEFAULT_RUN_URL).replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetchImpl(`${base}/api/iam/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, password }),
    });
  } catch {
    throw new Error(`Datalayer could not be reached at ${base}.`);
  }
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(
      body.message || `Datalayer refused the sign-in (${response.status}).`
    );
  }
  if (!body.token) {
    throw new Error('Datalayer answered the sign-in without a token.');
  }
  return body.token;
}
