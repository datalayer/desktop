/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Work in a folder (DESKTOP DK-07), the pure parts: the harness choices
 * with their terms, the applications offered, the configure body, the
 * agent made, the session the start stream names, a refusal as the
 * runtime said it, the chat's protocol on a local runtime.
 */

import { describe, expect, it } from 'vitest';
import type { HarnessFacts } from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import {
  agentIdOf,
  appChoices,
  blankHarnessApp,
  configureBody,
  harnessChoices,
  localSessionProtocol,
  runtimeRefusal,
  sessionUidOfEvents,
} from '../workInFolder';

const CLAUDE_CODE: HarnessFacts = {
  id: 'claude-code',
  name: 'Claude Code',
  adapter: '@agentclientprotocol/claude-agent-acp',
  adapterVersion: '0.91.0',
  credential: 'ANTHROPIC_API_KEY',
  secrets: ['ANTHROPIC_API_KEY'],
  binaries: ['node', 'git'],
  registeredBinaries: 'Node 22 (engines.node >=22 on npm), git',
  servedToThirdParties: 'api_key_only',
  licence: 'Anthropic Commercial Terms',
  tierRestrictions: '',
  capabilities: {
    resume: 'vendor',
    forkHistory: 'replay',
    interrupt: true,
    steering: false,
    images: true,
    compaction: 'vendor',
  },
} as HarnessFacts;

describe('the harness picker', () => {
  it('lists each harness with the credential it takes and its terms', () => {
    const [choice] = harnessChoices([CLAUDE_CODE]);
    expect(choice.id).toBe('claude-code');
    expect(choice.label).toBe('Claude Code');
    expect(choice.description).toBe('takes ANTHROPIC_API_KEY');
    expect(choice.detail).toBe(
      'Serving others: api key only · Anthropic Commercial Terms · adapter @agentclientprotocol/claude-agent-acp 0.91.0'
    );
  });
});

describe('the application picker', () => {
  it('offers the blank harness application first, then the folder’s own Appspecs', () => {
    const choices = appChoices({ id: 'codex', name: 'Codex' }, 'app', [
      {
        path: 'apps/triage.yaml',
        spec: { id: 'triage', name: 'Triage', description: 'Sorts issues.' },
      },
    ]);
    expect(choices.map(c => c.label)).toEqual([
      'Codex in this folder',
      'Triage',
    ]);
    expect(choices[0].path).toBe('');
    expect(choices[1]).toMatchObject({
      description: 'apps/triage.yaml',
      detail: 'Sorts issues.',
    });
  });

  it('builds the blank harness application: the harness as the agent, deleting and running asked first', () => {
    const spec = blankHarnessApp(
      { id: 'claude-code', name: 'Claude Code' },
      'app'
    );
    expect(spec).toMatchObject({
      schema: 'loop.app/v1',
      id: 'desktop-claude-code',
      name: 'Claude Code in app',
      agent: 'example-harness-claude-code',
      tags: ['harness', 'desktop'],
    });
    const rules = spec.rules as { applies_to: string; behaviour: string }[];
    expect(
      Object.fromEntries(rules.map(rule => [rule.applies_to, rule.behaviour]))
    ).toEqual({
      read: 'do_it',
      write: 'do_it',
      delete: 'ask_me_first',
      execute: 'ask_me_first',
      host_context: 'do_it',
    });
    expect(configureBody(spec)).toEqual({ app: spec });
  });
});

describe('the runtime’s answers', () => {
  it('reads the agent the runtime made, the runtime’s default when it names none', () => {
    expect(agentIdOf({ agent_id: 'desktop-claude-code' })).toBe(
      'desktop-claude-code'
    );
    expect(agentIdOf({ id: 'x' })).toBe('x');
    expect(agentIdOf({})).toBe('default');
  });

  it('reads the session the start stream names, and refuses a stream naming none', () => {
    expect(
      sessionUidOfEvents([
        { type: 'RUN_STARTED' },
        { type: 'CUSTOM', name: 'loop.session', value: { uid: 's-9' } },
      ])
    ).toBe('s-9');
    expect(() => sessionUidOfEvents([{ type: 'RUN_STARTED' }])).toThrow(
      /opened no session/
    );
  });

  it('says a refusal as the runtime said it: its detail, its problems, else the text', () => {
    expect(
      runtimeRefusal(
        'Configuring the application',
        422,
        '{"detail":"no such agent"}'
      )
    ).toBe(
      'Configuring the application was refused by the local runtime (422): no such agent'
    );
    expect(
      runtimeRefusal(
        'Configuring the application',
        422,
        '{"detail":{"problems":["a","b"]}}'
      )
    ).toBe(
      'Configuring the application was refused by the local runtime (422): a b'
    );
    expect(runtimeRefusal('Opening the session', 500, '')).toBe(
      'Opening the session was refused by the local runtime (500).'
    );
  });
});

describe('the chat’s protocol on a local runtime', () => {
  it('speaks the session API’s AG-UI route of the agent, with its ui channel and sessions route, unsigned', () => {
    const protocol = localSessionProtocol(
      'http://127.0.0.1:4321/',
      'desktop-claude-code'
    ) as Record<string, unknown>;
    expect(protocol).toMatchObject({
      type: 'ag-ui',
      endpoint:
        'http://127.0.0.1:4321/api/v1/apps/agents/desktop-claude-code/ag-ui/',
      agentId: 'desktop-claude-code',
      configEndpoint: 'http://127.0.0.1:4321/api/v1/configure',
      uiSocket: 'ws://127.0.0.1:4321/api/v1/apps/ui',
      appSessions: 'http://127.0.0.1:4321/api/v1/apps/sessions',
    });
    expect(protocol.authToken).toBeUndefined();
  });
});
