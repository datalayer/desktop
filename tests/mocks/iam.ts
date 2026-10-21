/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * A stub IAM and landing for the suite (DESKTOP DK-15, DK-03): one HTTP
 * server on loopback that answers what sign-in asks of IAM and what the
 * embedded Studio view loads of the landing, so no test needs a Datalayer
 * account. The app is pointed at it with `DATALAYER_IAM_URL` and
 * `DATALAYER_LANDING_URL`.
 *
 * - `GET /api/iam/v1/whoami` with the known bearer: the person's profile
 *   as IAM's `profile.whoami` shapes it; any other token is a 401;
 * - `POST /api/iam/v1/logout`;
 * - `GET /api/iam/v1/oauth2/authz/url?provider&callback_uri&nonce`: the
 *   provider's authorization URL (`loginURL`), here the stub's own
 *   `/stub/provider` page, with IAM's `state` (`<nonce>:<callback>`);
 * - `GET /stub/provider?state=`: the provider's page, which sends the
 *   browser on to the callback as IAM does — `window.location.replace(
 *   '<callback>?_xsrf=<nonce>&user=…&token=…')`;
 * - `GET /studio`, `/studio/*` and `/`: the landing's pages, one line each.
 *
 * @module tests/mocks/iam
 */

import { createServer, type Server } from 'node:http';

/** What a started stub IAM gives the test. */
export interface StubIam {
  /** Its origin, `http://127.0.0.1:<port>`. */
  url: string;
  /** The one token it knows. */
  token: string;
  /** The person it signs in. */
  profile: {
    uid: string;
    handle: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  /** The paths the landing was asked for, in order. */
  landingPaths: string[];
  /** The authorization URLs asked for, with their callback URIs. */
  authzAsked: Array<{ provider: string; callbackUri: string; nonce: string }>;
  /** Stops it. */
  close: () => Promise<void>;
}

/**
 * Starts the stub IAM on a free loopback port.
 *
 * @param options - The token it knows (random by default).
 *
 * @returns The running stub.
 */
export async function startStubIam(
  options: { token?: string } = {}
): Promise<StubIam> {
  const token =
    options.token ?? `stub-token-${Math.random().toString(36).slice(2)}`;
  const profile = {
    uid: 'person-1',
    handle: 'ada',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  };
  const landingPaths: string[] = [];
  const authzAsked: StubIam['authzAsked'] = [];
  const nonces = new Set<string>();
  let origin = '';

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const json = (status: number, value: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    const html = (status: number, text: string) => {
      response.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      response.end(text);
    };
    const bearer = (request.headers.authorization || '').replace(
      /^Bearer\s+/i,
      ''
    );
    const method = request.method || 'GET';
    const path = url.pathname;

    if (path === '/api/iam/v1/whoami') {
      if (bearer !== token) {
        return json(401, {
          success: false,
          message: 'The token is not one IAM issued.',
        });
      }
      return json(200, {
        success: true,
        message: 'The profile.',
        profile: {
          id: profile.uid,
          uid: profile.uid,
          handle_s: profile.handle,
          email_s: profile.email,
          first_name_t: profile.firstName,
          last_name_t: profile.lastName,
          avatar_url_s: '',
        },
      });
    }
    if (path === '/api/iam/v1/logout' && method === 'POST') {
      return json(200, { success: true, message: 'Signed out.' });
    }
    if (path === '/api/iam/v1/oauth2/authz/url') {
      const provider = url.searchParams.get('provider') || '';
      const callbackUri = url.searchParams.get('callback_uri') || '';
      const nonce = url.searchParams.get('nonce') || '';
      if (!['github', 'google', 'linkedin', 'okta'].includes(provider)) {
        return json(400, {
          detail: `${provider} is not a supported provider.`,
        });
      }
      if (!callbackUri) {
        return json(400, { detail: 'callback_uri is required.' });
      }
      authzAsked.push({ provider, callbackUri, nonce });
      const serverNonce = `nonce-${Math.random().toString(36).slice(2)}`;
      nonces.add(serverNonce);
      const state = `${serverNonce}:${encodeURIComponent(callbackUri)}`;
      return json(200, {
        success: true,
        message: `${provider} authorization URL.`,
        loginURL: `${origin}/stub/provider?state=${encodeURIComponent(state)}`,
      });
    }
    if (path === '/stub/provider') {
      const state = url.searchParams.get('state') || '';
      const [serverNonce, ...rest] = state.split(':');
      const callbackUri = decodeURIComponent(rest.join(':'));
      if (!nonces.delete(serverNonce)) {
        return json(401, { detail: 'Invalid state.' });
      }
      const target =
        `${callbackUri}?_xsrf=${encodeURIComponent(serverNonce)}` +
        `&user=${encodeURIComponent(profile.handle)}&token=${encodeURIComponent(token)}`;
      return html(
        200,
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Signing in</title></head>` +
          `<body><h3>Redirecting to Datalayer...</h3>` +
          `<script>window.location.replace(${JSON.stringify(target)});</script></body></html>`
      );
    }
    if (path === '/' || path.startsWith('/studio')) {
      landingPaths.push(path + url.search);
      return html(
        200,
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Studio</title></head>` +
          `<body><h1 id="studio">Studio</h1><p>${path}</p></body></html>`
      );
    }
    json(404, { detail: `The stub IAM does not serve ${method} ${path}.` });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  origin = `http://127.0.0.1:${port}`;

  return {
    url: origin,
    token,
    profile,
    landingPaths,
    authzAsked,
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
