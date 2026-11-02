/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The credentials a harness declares (`ANTHROPIC_API_KEY` for Claude
 * Code), kept in the app's keychain (DESKTOP DK-06, decision O-2): typed
 * once in a dialog, encrypted with Electron's `safeStorage` (the OS
 * keychain: Keychain, DPAPI, libsecret), written under the app's user data
 * folder, never shown and never logged. The environment is read first; the
 * keychain second (`portable/localRuntime.ts`'s `runtimeEnvironment`); the
 * app says which it used.
 *
 * No fallback: a machine without the OS keychain cannot keep a credential
 * here, and is told so in a sentence — the person sets it in their
 * environment instead. (The sign-in token has its own base64 fallback in
 * the SDK bridge; a harness key does not get one.)
 *
 * @module main/services/credentials
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { app, safeStorage } from 'electron';
import log from 'electron-log/main';
import { credentialSecretKey } from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import { CREDENTIAL_NAME } from '../../shared/types/ipc.types';

/** The file under the app's user data folder: one base64 ciphertext per key. */
export const CREDENTIALS_FILE = 'harness-credentials.json';

/** The sentence when the OS keychain is not there to encrypt with. */
export const NO_KEYCHAIN_SENTENCE =
  'Desktop cannot keep a credential on this machine: the OS keychain is not available to encrypt it. Set it in your environment before starting Desktop instead.';

/** What the store reads and writes, so the tests give it a folder and a cipher of their own. */
export interface CredentialsDeps {
  /** The folder the file lives in. */
  folder: () => string;
  /** Whether the OS keychain encrypts here. */
  encryptionAvailable: () => boolean;
  encrypt: (plain: string) => Buffer;
  decrypt: (cipher: Buffer) => string;
}

/** The credentials store: get, set, has, forget. */
export interface Credentials {
  /** The value, or undefined when the keychain holds none. */
  get(name: string): string | undefined;
  /** Keeps a value; an empty value forgets it. Refuses without the keychain, in a sentence. */
  set(name: string, value: string): void;
  has(name: string): boolean;
  /** The file's path, for the docs and the tests. */
  file(): string;
}

function checkName(name: string): void {
  if (!CREDENTIAL_NAME.test(name)) {
    throw new Error(
      `A credential's name is as the harness declares it (ANTHROPIC_API_KEY), not ${JSON.stringify(name)}.`
    );
  }
}

/**
 * A credentials store over a folder and a cipher.
 *
 * @param deps - The folder and the cipher.
 *
 * @returns The store.
 */
export function createCredentials(deps: CredentialsDeps): Credentials {
  const file = (): string => join(deps.folder(), CREDENTIALS_FILE);

  const read = (): Record<string, string> => {
    const path = file();
    if (!existsSync(path)) {
      return {};
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(
        `The credentials file ${path} cannot be read: ${error instanceof Error ? error.message : String(error)}. Move it away to start afresh.`
      );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(
        `The credentials file ${path} is not an object of keys: move it away to start afresh.`
      );
    }
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (typeof value === 'string') {
        kept[key] = value;
      }
    }
    return kept;
  };

  const write = (kept: Record<string, string>): void => {
    const path = file();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(kept, null, 2), { mode: 0o600 });
  };

  return {
    file,
    get(name) {
      checkName(name);
      const cipher = read()[credentialSecretKey(name)];
      if (!cipher) {
        return undefined;
      }
      if (!deps.encryptionAvailable()) {
        throw new Error(NO_KEYCHAIN_SENTENCE);
      }
      return deps.decrypt(Buffer.from(cipher, 'base64'));
    },
    set(name, value) {
      checkName(name);
      const kept = read();
      const key = credentialSecretKey(name);
      if (!value) {
        delete kept[key];
        write(kept);
        log.info(`[Credentials] ${name} forgotten.`);
        return;
      }
      if (!deps.encryptionAvailable()) {
        throw new Error(NO_KEYCHAIN_SENTENCE);
      }
      kept[key] = deps.encrypt(value).toString('base64');
      write(kept);
      // The name, never the value.
      log.info(`[Credentials] ${name} kept in the keychain.`);
    },
    has(name) {
      checkName(name);
      return Boolean(read()[credentialSecretKey(name)]);
    },
  };
}

/** The app's store: `safeStorage` over the user data folder. */
export const credentials: Credentials = createCredentials({
  folder: () => app.getPath('userData'),
  encryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: plain => safeStorage.encryptString(plain),
  decrypt: cipher => safeStorage.decryptString(cipher),
});
