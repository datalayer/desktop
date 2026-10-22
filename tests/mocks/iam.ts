/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * A stub IAM and landing for the suite (DESKTOP DK-15, DK-03): one HTTP
 * server on loopback that answers what sign-in asks of IAM and what the
 * Apps tab reads of Spacer and ai-agents, so no test needs a Datalayer
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
 * - Apps' routes, for a launch that points `DATALAYER_SPACER_URL`
 *   and `DATALAYER_AI_AGENTS_URL` here: Spacer's applications
 *   (`/api/spacer/v1/spaces/items/types/app`, one application `app-1`) and
 *   its item (`/api/spacer/v1/lexicals/app-1`, with its Appspec);
 *   ai-agents' deployments (`/api/ai-agents/v1/apps/deployments`, one live,
 *   not kept always on) and their change (`PATCH …/{uid}`, recorded in
 *   `stateChanges`), its sessions (one of `app-1`, cloned) and its pending
 *   Tool Approvals (none).
 *
 * @module tests/mocks/iam
 */

import { createHash, randomBytes } from 'node:crypto';
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
  /** The deployment changes asked (`PATCH /apps/deployments/{uid}`), in order. */
  stateChanges: Array<{ uid: string; version: number; state: string }>;
  /** The authorization URLs asked for, with their callback URIs. */
  authzAsked: Array<{ provider: string; callbackUri: string; nonce: string }>;
  /** Stops it. */
  close: () => Promise<void>;
}

/**
 * A token shaped as IAM's are — a JWT: three base64url parts, its payload
 * the subject and an hour of life — since `@datalayer/core` refuses any
 * other shape before it asks IAM. Unsigned: only this stub reads it.
 *
 * @param subject - The person's uid.
 *
 * @returns The token.
 */
export function stubJwt(subject: string): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return [
    part({ alg: 'HS256', typ: 'JWT' }),
    part({
      sub: subject,
      iat: now,
      exp: now + 3600,
      jti: randomBytes(16).toString('hex'),
    }),
    randomBytes(32).toString('base64url'),
  ].join('.');
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
  const token = options.token ?? stubJwt('person-1');
  const profile = {
    uid: 'person-1',
    handle: 'ada',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  };
  const stateChanges: StubIam['stateChanges'] = [];
  const deployment = {
    uid: 'dep-1',
    app_uid: 'app-1',
    app_name: 'Desk',
    version: 3,
    state: 'live',
    target: 'hosted',
    slug: 'desk',
    always_on: false,
  };
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
          // IAM always says one (Gravatar's, from the email); @datalayer/core
          // refuses a profile without it.
          avatar_url_s: `https://www.gravatar.com/avatar/${createHash('md5')
            .update(profile.email)
            .digest('hex')}`,
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
    if (path.startsWith('/api/spacer/') || path.startsWith('/api/ai-agents/')) {
      if (bearer !== token) {
        return json(401, { detail: 'The token is not one IAM issued.' });
      }
    }
    if (path === '/api/spacer/v1/spaces/items/types/app') {
      return json(200, {
        success: true,
        items: [
          {
            uid: 'app-1',
            type_s: 'app',
            name_t: 'Desk',
            description_t: 'Answers the books.',
            last_update_ts_dt: '2026-10-20T10:00:00Z',
          },
        ],
      });
    }
    if (path === '/api/spacer/v1/lexicals/app-1') {
      return json(200, {
        success: true,
        document: {
          uid: 'app-1',
          type_s: 'app',
          name_t: 'Desk',
          model_s: JSON.stringify({
            format: 'loop.app.item/v1',
            spec: {
              schema: 'loop.app/v1',
              name: 'Desk',
              kind: 'chat',
              description: 'Answers the books.',
              agent: 'accountant',
            },
            state: { revision: 3 },
          }),
        },
      });
    }
    if (path === '/api/ai-agents/v1/apps/deployments' && method === 'GET') {
      return json(200, { deployments: [deployment] });
    }
    if (
      path === `/api/ai-agents/v1/apps/deployments/${deployment.uid}` &&
      method === 'PATCH'
    ) {
      let body = '';
      request.on('data', chunk => (body += String(chunk)));
      request.on('end', () => {
        const asked = JSON.parse(body || '{}') as {
          version: number;
          state: string;
        };
        stateChanges.push({ uid: deployment.uid, ...asked });
        if (asked.version !== deployment.version) {
          return json(409, {
            detail: `Version ${asked.version} is not the one deployed.`,
          });
        }
        deployment.state = asked.state;
        json(200, { deployment });
      });
      return;
    }
    if (path === '/api/ai-agents/v1/apps/sessions') {
      return json(200, {
        sessions: [
          {
            uid: 'ses-2',
            state: 'paused',
            title: 'Close the books',
            app_uid: 'app-1',
            agent: 'accountant',
            version: 3,
            started_at: '2026-10-20T11:00:00Z',
            lineage: { forked_from: { uid: 'ses-1', at_turn: 2 } },
          },
        ],
        has_more: false,
      });
    }
    if (path === '/api/ai-agents/v1/tool-approvals') {
      return json(200, { approvals: [] });
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
    stateChanges,
    authzAsked,
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
