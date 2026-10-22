/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The IPC contract's readers (DESKTOP §7): each channel's argument read at
 * the boundary, a wrong shape refused in a sentence naming the channel —
 * never guessed, never defaulted.
 */

import { describe, expect, it } from 'vitest';
import {
  IPC,
  readCredential,
  readCredentialName,
  readDecision,
  readFilter,
  readFolder,
  readFront,
  readHarness,
  readOpenFile,
  readOptionalFolder,
  readPlace,
  readRevealPath,
  readSave,
  readAppUid,
  readDeploymentStateChange,
} from '../types/ipc.types';

describe('the folders', () => {
  it('reads a folder, and refuses anything else', () => {
    expect(
      readFolder({ folder: '/home/ada/project' }, IPC.localRuntimeStart)
    ).toBe('/home/ada/project');
    expect(() => readFolder({}, IPC.localRuntimeStart)).toThrow(
      'local-runtime:start takes folder as a non-empty string.'
    );
    expect(() => readFolder('/x', IPC.localRuntimeStart)).toThrow(
      /takes an object/
    );
    expect(() => readFolder({ folder: '  ' }, IPC.localRuntimeStart)).toThrow(
      /non-empty/
    );
  });

  it('reads an optional folder: none, or a string', () => {
    expect(readOptionalFolder(undefined, IPC.localRuntimeStop)).toBeUndefined();
    expect(readOptionalFolder({}, IPC.localRuntimeStop)).toBeUndefined();
    expect(readOptionalFolder({ folder: '/p' }, IPC.localRuntimeStop)).toBe(
      '/p'
    );
    expect(() =>
      readOptionalFolder({ folder: 3 }, IPC.localRuntimeStop)
    ).toThrow(/as a string when given/);
  });

  it('reads a harness id', () => {
    expect(readHarness({ harness: 'claude-code' })).toBe('claude-code');
    expect(() => readHarness({ harness: '' })).toThrow(
      /harness as a non-empty/
    );
  });
});

describe('the credentials', () => {
  it('takes a name as the harness declares it, and a string value, empty allowed', () => {
    expect(readCredential({ name: 'ANTHROPIC_API_KEY', value: 'sk' })).toEqual({
      name: 'ANTHROPIC_API_KEY',
      value: 'sk',
    });
    expect(readCredential({ name: 'OPENAI_API_KEY', value: '' }).value).toBe(
      ''
    );
    expect(() =>
      readCredential({ name: 'anthropic key', value: 'sk' })
    ).toThrow(/as the harness declares it/);
    expect(() => readCredential({ name: 'X_KEY', value: 1 })).toThrow(
      /value as a string/
    );
    expect(readCredentialName({ name: 'X_KEY' })).toBe('X_KEY');
    expect(() => readCredentialName({ name: '../etc' })).toThrow(
      /as the harness declares it/
    );
  });
});

describe('the list and the places', () => {
  it('narrows nothing without a filter, and refuses a state or a place that is none', () => {
    expect(readFilter(undefined)).toEqual({
      app: '',
      state: '',
      title: '',
      place: '',
    });
    expect(readFilter({ filter: { state: 'paused', place: 'local' } })).toEqual(
      {
        app: '',
        title: '',
        state: 'paused',
        place: 'local',
      }
    );
    expect(readFilter({ app: 'desk', title: 'Fix' })).toMatchObject({
      app: 'desk',
      title: 'Fix',
    });
    expect(() => readFilter({ state: 'stopped' })).toThrow(
      'sessions:list narrows to a state of open, paused or ended, not "stopped".'
    );
    expect(() => readFilter({ place: 'phone' })).toThrow(
      /place of datalayer or local/
    );
  });

  it('reads a place, the local one with a loopback url', () => {
    expect(readPlace({ kind: 'datalayer' }, IPC.approvalsDecide)).toEqual({
      kind: 'datalayer',
    });
    expect(
      readPlace(
        {
          kind: 'local',
          folder: '/p',
          folderName: 'p',
          url: 'http://127.0.0.1:41231',
        },
        IPC.approvalsDecide
      )
    ).toEqual({
      kind: 'local',
      folder: '/p',
      folderName: 'p',
      url: 'http://127.0.0.1:41231',
    });
    expect(() =>
      readPlace(
        {
          kind: 'local',
          folder: '/p',
          folderName: 'p',
          url: 'https://evil.example',
        },
        IPC.approvalsDecide
      )
    ).toThrow(/url as http:\/\/127\.0\.0\.1:<port>/);
    expect(() => readPlace({ kind: 'phone' }, IPC.approvalsDecide)).toThrow(
      /kind datalayer or local/
    );
  });
});

describe('the decisions', () => {
  it('reads a decision of approve or reject with its place, the note when given', () => {
    expect(
      readDecision({
        place: { kind: 'datalayer' },
        id: 'a1',
        decision: 'approve',
      })
    ).toEqual({ place: { kind: 'datalayer' }, id: 'a1', decision: 'approve' });
    expect(
      readDecision({
        place: { kind: 'datalayer' },
        id: 'a1',
        decision: 'reject',
        note: 'not now',
      }).note
    ).toBe('not now');
    expect(() =>
      readDecision({
        place: { kind: 'datalayer' },
        id: 'a1',
        decision: 'maybe',
      })
    ).toThrow(
      'approvals:decide takes a decision of approve or reject, not "maybe".'
    );
    expect(() =>
      readDecision({ place: { kind: 'datalayer' }, decision: 'approve' })
    ).toThrow(/id as a non-empty/);
  });
});

describe('the dialogs, the shell, Apps, the front', () => {
  it('saves under a file name, never a path', () => {
    expect(readSave({ name: 'e67a.session.jsonl', text: '{}' })).toEqual({
      name: 'e67a.session.jsonl',
      text: '{}',
    });
    expect(() => readSave({ name: '../x.jsonl', text: '' })).toThrow(
      /a file name, not a path/
    );
    expect(() => readSave({ name: 'x', text: 1 })).toThrow(/text as a string/);
  });

  it('opens a file of the accepted extensions', () => {
    expect(readOpenFile({ accept: ['jsonl', '.yaml'] })).toEqual({
      accept: ['jsonl', 'yaml'],
    });
    expect(() => readOpenFile({ accept: [] })).toThrow(/list of extensions/);
    expect(() => readOpenFile({ accept: ['*'] })).toThrow(/list of extensions/);
  });

  it('reveals an absolute path only', () => {
    expect(readRevealPath({ path: '/home/ada/project' })).toBe(
      '/home/ada/project'
    );
    expect(readRevealPath({ path: 'C:\\Users\\ada' })).toBe('C:\\Users\\ada');
    expect(() => readRevealPath({ path: 'project' })).toThrow(/absolute path/);
  });

  it('reads an application of Apps by uid, never a path', () => {
    expect(readAppUid({ uid: 'app-1' })).toBe('app-1');
    expect(() => readAppUid({ uid: '../x' })).toThrow(/an application's uid/);
    expect(() => readAppUid({})).toThrow(/uid/);
  });

  it('changes one exact version of a deployment, live or paused', () => {
    expect(
      readDeploymentStateChange({ uid: 'dep-1', version: 3, state: 'paused' })
    ).toEqual({ uid: 'dep-1', version: 3, state: 'paused' });
    expect(() =>
      readDeploymentStateChange({ uid: 'dep-1', version: 0, state: 'live' })
    ).toThrow(/one exact version/);
    expect(() =>
      readDeploymentStateChange({ uid: 'dep-1', version: 2, state: 'gone' })
    ).toThrow(/live or paused/);
    expect(() =>
      readDeploymentStateChange({ uid: 'a/b', version: 2, state: 'live' })
    ).toThrow(/a deployment's uid/);
  });

  it('reads the session in front, or none', () => {
    expect(readFront({ uid: 'e67a' })).toBe('e67a');
    expect(readFront({ uid: null })).toBeNull();
    expect(readFront({})).toBeNull();
    expect(() => readFront({ uid: 7 })).toThrow(/uid as a non-empty/);
  });
});
