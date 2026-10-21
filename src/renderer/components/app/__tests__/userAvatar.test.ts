/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

import { describe, it, expect } from 'vitest';
import { avatarInitialOf, avatarSourceOf } from '../userAvatar';

describe('avatarSourceOf', () => {
  it('keeps an https picture', () => {
    const url = 'https://media.example.com/photo.jpg?e=1&t=abc';
    expect(avatarSourceOf(url)).toBe(url);
  });

  it('refuses no URL, an empty one, a relative one or http', () => {
    expect(avatarSourceOf(undefined)).toBeUndefined();
    expect(avatarSourceOf('   ')).toBeUndefined();
    expect(avatarSourceOf('/api/iam/v1/avatar')).toBeUndefined();
    expect(avatarSourceOf('http://example.com/a.png')).toBeUndefined();
  });

  it("refuses Gravatar's placeholder", () => {
    expect(
      avatarSourceOf('https://www.gravatar.com/avatar/abc?d=identicon')
    ).toBeUndefined();
  });
});

describe('avatarInitialOf', () => {
  it("draws the handle's initial, upper-cased", () => {
    expect(avatarInitialOf({ handle: 'echarles', displayName: 'Eric' })).toBe(
      'E'
    );
    expect(avatarInitialOf({ handle: 'zoe' })).toBe('Z');
  });

  it('falls back to the display name, then to a question mark', () => {
    expect(avatarInitialOf({ handle: ' ', displayName: 'ada lovelace' })).toBe(
      'A'
    );
    expect(avatarInitialOf({})).toBe('?');
  });
});
