/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Studio page's view model (DESKTOP DK-02): the applications with what
 * their deployments say, Build from the Appspec (agent-runtimes' reader and
 * writer), Try's deployment or why not, Activity's rows from the Sessions
 * list with their lineage, Deployments' rows and the change offered; and
 * *Open in the Studio* kept until the page takes it.
 */

import { describe, expect, it } from 'vitest';
import { readAppspecYaml } from '@datalayer/agent-runtimes/lib/apps/apps/yaml';
import {
  listedSessionOf,
  mergePlaces,
  type SessionPlace,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type { AppChatChoice } from '../../../shared/appChat';
import {
  studioDeploymentsOf,
  type StudioAppDocument,
} from '../../../shared/studio';
import {
  activityRowsOf,
  appRowsOf,
  buildViewOf,
  closedSentencesOf,
  deploymentRowsOf,
  deploymentsSaid,
  STUDIO_WORDS,
  tryDecisionOf,
} from '../studioPage';
import {
  OPEN_STUDIO_EVENT,
  requestStudioOpen,
  takeStudioOpen,
} from '../studioEvents';

const DEPLOYMENTS = studioDeploymentsOf({
  deployments: [
    {
      uid: 'd1',
      app_uid: 'u1',
      app_name: 'Desk',
      version: 3,
      state: 'live',
      target: 'hosted',
      slug: 'desk',
      always_on: true,
      kept: { state: 'running' },
    },
    {
      uid: 'd2',
      app_uid: 'u1',
      app_name: 'Desk',
      version: 2,
      state: 'paused',
      target: 'embedded',
    },
    {
      uid: 'd3',
      app_uid: 'u2',
      app_name: 'Other',
      version: 1,
      state: 'paused',
    },
  ],
});

describe('the applications listed', () => {
  it('say what their deployments say', () => {
    const rows = appRowsOf(
      [
        { uid: 'u1', name: 'Desk', description: '', updatedAt: '' },
        { uid: 'u2', name: 'Other', description: '', updatedAt: '' },
        { uid: 'u3', name: 'Draft', description: '', updatedAt: '' },
      ],
      DEPLOYMENTS
    );
    expect(rows.map(row => row.said)).toEqual([
      'Live · version 3',
      'Paused',
      'Not deployed',
    ]);
    expect(appRowsOf([rows[0].app], null)[0].said).toBe('');
    expect(deploymentsSaid([DEPLOYMENTS[1], DEPLOYMENTS[2]])).toBe(
      '2 deployments, all paused'
    );
  });
});

describe('Build', () => {
  it('lists the Appspec’s facts and writes its YAML, which reads back', () => {
    const document: StudioAppDocument = {
      uid: 'u1',
      name: 'Desk',
      description: '',
      revision: 4,
      spec: {
        schema: 'loop.app/v1',
        name: 'Desk',
        kind: 'chat',
        description: 'Answers the books.',
        agent: 'accountant',
        skills: ['ledger'],
      },
      problem: '',
    };
    const view = buildViewOf(document);
    if (view.kind !== 'spec') {
      throw new Error('Build should show the spec.');
    }
    expect(view.facts).toEqual(
      expect.arrayContaining([
        { label: 'Name', value: 'Desk' },
        { label: 'Kind', value: 'chat' },
        { label: 'Agent', value: 'accountant' },
        { label: 'Skills', value: 'ledger' },
        { label: 'Revision', value: '4' },
      ])
    );
    expect(view.yaml).toContain('name: Desk');
    expect(readAppspecYaml(view.yaml).app.agent).toBe('accountant');
  });

  it('says why there is no Appspec', () => {
    expect(
      buildViewOf({
        uid: 'u1',
        name: 'Draft',
        description: '',
        revision: 0,
        spec: null,
        problem: 'none here',
      })
    ).toEqual({ kind: 'none', sentence: 'none here' });
  });
});

describe('Try', () => {
  const handle = {
    uid: 'd1',
    appUid: 'u1',
    name: 'Desk',
    version: 3,
    target: 'hosted',
    slug: 'desk',
    url: 'https://r.io',
    agentId: 'desk-agent',
  };
  const choices: AppChatChoice[] = [
    { kind: 'talk', handle },
    { kind: 'closed', uid: 'd2', name: 'Desk', why: 'Desk is paused.' },
    { kind: 'closed', uid: 'd3', name: 'Other', why: 'Other is paused.' },
  ];

  it('talks to a deployment of the application that can be talked to', () => {
    expect(tryDecisionOf('u1', choices)).toEqual({ kind: 'talk', handle });
  });

  it('says why not, with its own deployments’ sentences only', () => {
    expect(tryDecisionOf('u2', choices)).toEqual({
      kind: 'closed',
      sentence: STUDIO_WORDS.notTalkable,
    });
    expect(
      closedSentencesOf(
        choices,
        DEPLOYMENTS.filter(one => one.appUid === 'u2')
      )
    ).toEqual(['Other is paused.']);
  });
});

describe('Activity', () => {
  const DATALAYER: SessionPlace = { kind: 'datalayer' };
  const raw = (uid: string, more: Record<string, unknown>) =>
    listedSessionOf({
      uid,
      state: 'open',
      title: `Session ${uid}`,
      agent: 'desk-agent',
      app_uid: 'u1',
      version: 3,
      ...more,
    });

  it('lists the application’s sessions newest first, with their lineage, never archived or another’s', () => {
    const places = mergePlaces([
      {
        place: DATALAYER,
        sessions: [
          raw('a', { started_at: '2026-10-01' }),
          raw('b', {
            started_at: '2026-10-03',
            lineage: { forked_from: { uid: 'a', at_turn: 2 } },
          }),
          raw('c', { started_at: '2026-10-04', archived: true }),
          raw('d', { started_at: '2026-10-05', app_uid: 'u2' }),
        ],
      },
    ]);
    const rows = activityRowsOf(places, 'u1');
    expect(rows.map(row => row.entry.row.uid)).toEqual(['b', 'a']);
    expect(rows[0].lineage).toBe('Cloned from a at turn 2');
    expect(rows[0].said).toBe('Open · desk-agent · version 3 · On Datalayer');
    expect(rows[1].lineage).toBe('');
  });
});

describe('Deployments', () => {
  it('offers pause for a live one and resume for a paused one', () => {
    const rows = deploymentRowsOf(DEPLOYMENTS.slice(0, 2));
    expect(rows.map(row => [row.title, row.action])).toEqual([
      ['hosted · desk', 'pause'],
      ['embedded', 'resume'],
    ]);
    expect(rows[0].said).toBe('Live · version 3 · kept always on, running');
    expect(rows[1].said).toBe('Paused · version 2 · not kept always on');
  });

  it('offers nothing for a deployment that says no version', () => {
    const [row] = deploymentRowsOf(
      studioDeploymentsOf({ deployments: [{ uid: 'x', state: 'live' }] })
    );
    expect(row.action).toBeNull();
  });
});

describe('Open in the Studio', () => {
  it('is said to the app and kept until the page takes it, once', () => {
    const heard: unknown[] = [];
    const listener = (event: Event) =>
      heard.push((event as CustomEvent).detail);
    window.addEventListener(OPEN_STUDIO_EVENT, listener);
    requestStudioOpen({ appUid: 'u1', section: 'activity' });
    window.removeEventListener(OPEN_STUDIO_EVENT, listener);
    expect(heard).toEqual([{ appUid: 'u1', section: 'activity' }]);
    expect(takeStudioOpen()).toEqual({ appUid: 'u1', section: 'activity' });
    expect(takeStudioOpen()).toBeNull();
  });
});
