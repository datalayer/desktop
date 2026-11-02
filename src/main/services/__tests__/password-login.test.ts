/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The handle and password sign-in: IAM's token on a 200, IAM's own
 * sentence on a refusal, a sentence when the answer carries no token.
 */

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RUN_URL, exchangePasswordForToken } from '../password-login';

const answer = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('exchangePasswordForToken', () => {
  it('returns the token of a 200, posting the handle and password to IAM', async () => {
    const fetchImpl = vi.fn(async () =>
      answer(200, { success: true, token: 'jwt-1' })
    );

    const token = await exchangePasswordForToken(
      { runUrl: 'https://r1.datalayer.run/', handle: 'ada', password: 'pw' },
      fetchImpl as unknown as typeof fetch
    );

    expect(token).toBe('jwt-1');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://r1.datalayer.run/api/iam/v1/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ handle: 'ada', password: 'pw' }),
      })
    );
  });

  it('uses the default Run URL when none is given', async () => {
    const fetchImpl = vi.fn(async () => answer(200, { token: 'jwt-2' }));

    await exchangePasswordForToken(
      { handle: 'ada', password: 'pw' },
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_RUN_URL}/api/iam/v1/login`,
      expect.anything()
    );
  });

  it("throws IAM's message on a 401", async () => {
    const fetchImpl = vi.fn(async () =>
      answer(401, { success: false, message: 'Invalid credentials.' })
    );

    await expect(
      exchangePasswordForToken(
        { handle: 'ada', password: 'wrong' },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow('Invalid credentials.');
  });

  it('names the status when a refusal has no message', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error('not json');
          },
        }) as unknown as Response
    );

    await expect(
      exchangePasswordForToken(
        { handle: 'ada', password: 'pw' },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow('Datalayer refused the sign-in (502).');
  });

  it('throws when a 200 carries no token', async () => {
    const fetchImpl = vi.fn(async () => answer(200, { success: true }));

    await expect(
      exchangePasswordForToken(
        { handle: 'ada', password: 'pw' },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow('Datalayer answered the sign-in without a token.');
  });

  it('says when Datalayer cannot be reached', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(
      exchangePasswordForToken(
        { runUrl: 'https://nowhere.example', handle: 'ada', password: 'pw' },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow(
      'Datalayer could not be reached at https://nowhere.example.'
    );
  });

  it('asks for both the handle and the password before calling IAM', async () => {
    const fetchImpl = vi.fn();

    await expect(
      exchangePasswordForToken(
        { handle: 'ada', password: '' },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow('Both your handle and your password are needed.');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
