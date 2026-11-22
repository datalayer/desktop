/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * What the header's avatar shows: the profile's picture when IAM gives a
 * usable one, the person's initial otherwise.
 *
 * IAM's `avatar_url_s` can name a picture that no longer loads: a signed
 * link taken from the identity provider at sign-in expires, and the image
 * host then answers 403. The avatar falls back to the initial when the
 * image fails, so a dead link never draws a broken image.
 *
 * @module renderer/components/app/userAvatar
 */

/** The fields of a user the avatar reads. */
export interface AvatarUser {
  avatarUrl?: string;
  displayName?: string;
  handle?: string;
}

/** Gravatar's default image: a placeholder, not the person's picture. */
const GRAVATAR_DEFAULT_PREFIX = 'https://www.gravatar.com/avatar';

/**
 * The picture to load, or `undefined` for none: only an absolute `https:`
 * URL (what the renderer's policy allows), and not Gravatar's placeholder.
 */
export function avatarSourceOf(url: string | undefined): string | undefined {
  const value = url?.trim();
  if (!value) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:') {
    return undefined;
  }
  if (value.startsWith(GRAVATAR_DEFAULT_PREFIX)) {
    return undefined;
  }
  return value;
}

/** The letter drawn when there is no picture: the handle's, else the name's. */
export function avatarInitialOf(user: AvatarUser): string {
  const source = user.handle?.trim() || user.displayName?.trim() || '';
  const letter = Array.from(source)[0];
  return letter ? letter.toUpperCase() : '?';
}
