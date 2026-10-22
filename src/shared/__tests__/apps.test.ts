/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Apps' shapes (DESKTOP DK-02): the applications as Spacer lists
 * them, one application's Appspec from its item, the deployments as
 * ai-agents answers them, the one change offered, the landing's origin and
 * the web Apps' pages.
 */

import { describe, expect, it } from 'vitest';
import {
  LANDING_ORIGINS,
  NO_APPSPEC,
  deploymentUrl,
  landingOrigin,
  appDocumentOf,
  spacerAppUrl,
  listedAppsOf,
  spacerAppsUrl,
  appDeploymentsOf,
  appsWebUrl,
  toggledStateOf,
} from '../apps';

const SPEC = {
  schema: 'loop.app/v1',
  name: 'Desk',
  kind: 'chat',
  description: 'Answers the books.',
  agent: 'accountant',
};

describe('the landing and Apps on the web', () => {
  it('takes DATALAYER_LANDING_URL when it is a web origin, else the landing or the dev server', () => {
    expect(landingOrigin({}, false)).toBe(LANDING_ORIGINS.production);
    expect(landingOrigin({}, true)).toBe(LANDING_ORIGINS.development);
    expect(
      landingOrigin({ DATALAYER_LANDING_URL: 'http://127.0.0.1:9/x' }, false)
    ).toBe('http://127.0.0.1:9');
    expect(landingOrigin({ DATALAYER_LANDING_URL: 'file:///etc' }, false)).toBe(
      LANDING_ORIGINS.production
    );
  });

  it('opens the Home or an application on a tab', () => {
    expect(appsWebUrl('https://datalayer.ai/')).toBe(
      'https://datalayer.ai/studio'
    );
    expect(appsWebUrl('https://datalayer.ai', 'a b', 'ship')).toBe(
      'https://datalayer.ai/studio/apps/a%20b?tab=ship'
    );
  });

  it('names the routes', () => {
    expect(spacerAppsUrl('https://s.io/')).toBe(
      'https://s.io/api/spacer/v1/spaces/items/types/app'
    );
    expect(spacerAppUrl('https://s.io', 'u1')).toBe(
      'https://s.io/api/spacer/v1/lexicals/u1'
    );
    expect(deploymentUrl('https://a.io', 'd1')).toBe(
      'https://a.io/api/ai-agents/v1/apps/deployments/d1'
    );
  });
});

describe('the applications', () => {
  it('lists them newest first, an item without a uid left out', () => {
    const apps = listedAppsOf({
      items: [
        { uid: 'old', name_t: 'Old', last_update_ts_dt: '2026-01-01' },
        {
          uid: 'new',
          name_t: 'New',
          description_t: 'd',
          last_update_ts_dt: '2026-10-01',
        },
        { name_t: 'No uid' },
      ],
    });
    expect(apps.map(app => app.uid)).toEqual(['new', 'old']);
    expect(apps[0]).toEqual({
      uid: 'new',
      name: 'New',
      description: 'd',
      updatedAt: '2026-10-01',
    });
  });

  it('refuses an answer with no list', () => {
    expect(() => listedAppsOf({})).toThrow(/no list of applications/);
  });

  it('reads an application’s Appspec from its item, or says why there is none', () => {
    const read = appDocumentOf(
      {
        document: {
          type_s: 'app',
          name_t: 'Item name',
          model_s: JSON.stringify({
            format: 'loop.app.item/v1',
            spec: SPEC,
            state: { revision: 4 },
          }),
        },
      },
      'u1'
    );
    expect(read).toMatchObject({
      uid: 'u1',
      name: 'Desk',
      description: 'Answers the books.',
      revision: 4,
      problem: '',
    });
    expect(read.spec).toEqual(SPEC);

    const none = appDocumentOf(
      { document: { type_s: 'app', name_t: 'Draft', model_s: '{}' } },
      'u2'
    );
    expect(none).toMatchObject({
      name: 'Draft',
      spec: null,
      problem: NO_APPSPEC,
    });
    expect(() =>
      appDocumentOf({ document: { type_s: 'notebook' } }, 'u3')
    ).toThrow(/not an application/);
  });
});

describe('the deployments', () => {
  it('reads them as ai-agents answers', () => {
    const [one] = appDeploymentsOf({
      deployments: [
        {
          uid: 'd1',
          app_uid: 'u1',
          app_name: 'Desk',
          version: 3,
          target: 'hosted',
          state: 'live',
          slug: 'desk',
          always_on: true,
          kept: { state: 'running', url: 'https://r.io' },
        },
        { app_uid: 'no-uid' },
      ],
    });
    expect(one).toEqual({
      uid: 'd1',
      appUid: 'u1',
      appName: 'Desk',
      version: 3,
      target: 'hosted',
      state: 'live',
      slug: 'desk',
      alwaysOn: true,
      keptState: 'running',
      keptWhy: '',
      updatedAt: '',
    });
    expect(() => appDeploymentsOf({})).toThrow(/no list of deployments/);
  });

  it('pauses a live one and resumes a paused one, for its version', () => {
    expect(toggledStateOf({ uid: 'd1', version: 3, state: 'live' })).toEqual({
      uid: 'd1',
      version: 3,
      state: 'paused',
    });
    expect(toggledStateOf({ uid: 'd1', version: 2, state: 'paused' })).toEqual({
      uid: 'd1',
      version: 2,
      state: 'live',
    });
    expect(() =>
      toggledStateOf({ uid: 'd1', version: 0, state: 'live' })
    ).toThrow(/one exact version/);
  });
});
