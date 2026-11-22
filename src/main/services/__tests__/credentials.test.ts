/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The app's keychain for a harness's credentials (DESKTOP DK-06, O-2): a
 * value kept encrypted and never in clear in the file, forgotten with an
 * empty value, refused in a sentence without the OS keychain, its name as
 * the harness declares it; the log names the key, never the value.
 */

import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logged = vi.hoisted(() => ({ lines: [] as string[] }));

vi.mock('electron', () => ({
  app: { getPath: () => '/nowhere' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => Buffer.alloc(0),
    decryptString: () => '',
  },
}));

vi.mock('electron-log/main', () => ({
  default: {
    info: (line: string) => logged.lines.push(line),
    warn: (line: string) => logged.lines.push(line),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

/** A reversible cipher standing in for the OS keychain. */
const rot = (text: string): string =>
  text.replace(/[a-z]/g, c =>
    String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97)
  );

describe('the keychain', () => {
  let folder: string;
  let available = true;

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'desktop-credentials-'));
    available = true;
    logged.lines.length = 0;
  });

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  const store = async () => {
    const { createCredentials } = await import('../credentials');
    return createCredentials({
      folder: () => folder,
      encryptionAvailable: () => available,
      encrypt: plain => Buffer.from(rot(plain), 'utf8'),
      decrypt: cipher => rot(cipher.toString('utf8')),
    });
  };

  it('keeps a value encrypted, never in clear in the file nor in the log, and reads it back', async () => {
    const credentials = await store();
    expect(credentials.has('ANTHROPIC_API_KEY')).toBe(false);
    credentials.set('ANTHROPIC_API_KEY', 'sk-secret-value');
    expect(credentials.has('ANTHROPIC_API_KEY')).toBe(true);
    expect(credentials.get('ANTHROPIC_API_KEY')).toBe('sk-secret-value');
    const written = readFileSync(credentials.file(), 'utf8');
    expect(written).not.toContain('sk-secret-value');
    expect(written).toContain('datalayer.harness.credential.ANTHROPIC_API_KEY');
    expect(logged.lines.join('\n')).not.toContain('sk-secret-value');
    expect(logged.lines.join('\n')).toContain(
      'ANTHROPIC_API_KEY kept in the keychain'
    );
  });

  it('forgets a value given empty, and answers nothing for a name never kept', async () => {
    const credentials = await store();
    credentials.set('OPENAI_API_KEY', 'sk-other');
    credentials.set('OPENAI_API_KEY', '');
    expect(credentials.has('OPENAI_API_KEY')).toBe(false);
    expect(credentials.get('OPENAI_API_KEY')).toBeUndefined();
    expect(credentials.get('NEVER_KEPT')).toBeUndefined();
  });

  it('refuses to keep or read a value without the OS keychain, in a sentence', async () => {
    const credentials = await store();
    available = false;
    expect(() => credentials.set('ANTHROPIC_API_KEY', 'sk')).toThrow(
      /the OS keychain is not available/
    );
    expect(credentials.has('ANTHROPIC_API_KEY')).toBe(false);
  });

  it('takes a name as the harness declares it', async () => {
    const credentials = await store();
    expect(() => credentials.set('anthropic key', 'sk')).toThrow(
      /as the harness declares it/
    );
    expect(() => credentials.get('../x')).toThrow(/as the harness declares it/);
  });
});
