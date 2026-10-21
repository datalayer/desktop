/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * The Studio view's policies (DESKTOP DK-02): the origin, the navigation
 * answered (the landing followed, the sign-in callback caught, anything
 * else refused), a window-open sent outside or kept in the view, the
 * microphone for the landing origin and nothing else, the paths; and the
 * wiring — the partition, the handlers installed, the Home loaded, the
 * view shown at its bounds and hidden.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const contents = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    setWindowOpenHandler: vi.fn((handler: (...args: unknown[]) => unknown) => {
      handlers['window-open'] = handler as (...args: unknown[]) => void;
    }),
    loadURL: vi.fn(),
    getURL: vi.fn(() => 'https://datalayer.ai/studio'),
  };
  const view = {
    webContents: contents,
    setVisible: vi.fn(),
    setBounds: vi.fn(),
    getVisible: vi.fn(() => false),
    options: null as unknown,
  };
  const partitionSession = {
    setPermissionRequestHandler: vi.fn(
      (handler: (...args: unknown[]) => void) => {
        handlers['permission'] = handler;
      }
    ),
    clearStorageData: vi.fn(async () => undefined),
  };
  return { handlers, contents, view, partitionSession, openExternal: vi.fn() };
});

vi.mock('electron', () => ({
  WebContentsView: vi.fn(function (this: unknown, options: unknown) {
    electron.view.options = options;
    return electron.view;
  }),
  session: { fromPartition: vi.fn(() => electron.partitionSession) },
  shell: { openExternal: electron.openExternal },
}));

vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../app/environment', () => ({ isDevelopment: () => false }));

import {
  LANDING_ORIGINS,
  STUDIO_PARTITION,
  clearStudioSession,
  createStudioView,
  hideStudioView,
  isSignInCallback,
  navigationAnswer,
  openInStudio,
  permissionAnswer,
  showStudioView,
  studioOrigin,
  studioPath,
  studioPathOf,
  studioViewUrl,
  windowOpenAnswer,
} from '../studio-view';

const ORIGIN = 'https://datalayer.ai';

describe('studioOrigin', () => {
  it('is the landing in production and the dev server in development', () => {
    expect(studioOrigin({}, false)).toBe(LANDING_ORIGINS.production);
    expect(studioOrigin({}, true)).toBe(LANDING_ORIGINS.development);
  });

  it('takes DATALAYER_LANDING_URL when it is a web origin, and ignores it otherwise', () => {
    expect(
      studioOrigin(
        { DATALAYER_LANDING_URL: 'http://127.0.0.1:4567/studio' },
        false
      )
    ).toBe('http://127.0.0.1:4567');
    expect(
      studioOrigin({ DATALAYER_LANDING_URL: 'file:///etc/passwd' }, false)
    ).toBe(LANDING_ORIGINS.production);
    expect(
      studioOrigin(
        { DATALAYER_LANDING_URL: 'https://user:pw@evil.example' },
        false
      )
    ).toBe(LANDING_ORIGINS.production);
    expect(studioOrigin({ DATALAYER_LANDING_URL: 'not a url' }, true)).toBe(
      LANDING_ORIGINS.development
    );
  });
});

describe('navigationAnswer', () => {
  it('follows the landing origin, catches the sign-in callback, refuses the rest', () => {
    expect(
      navigationAnswer(
        'https://datalayer.ai/studio/apps/abc?tab=activity',
        ORIGIN
      )
    ).toBe('allow');
    expect(navigationAnswer('datalayer://auth?_xsrf=n&token=t', ORIGIN)).toBe(
      'sign-in-callback'
    );
    expect(navigationAnswer('datalayer://auth', ORIGIN)).toBe(
      'sign-in-callback'
    );
    expect(navigationAnswer('datalayer://sessions/abc', ORIGIN)).toBe('refuse');
    expect(
      navigationAnswer('https://github.com/login/oauth/authorize', ORIGIN)
    ).toBe('refuse');
    expect(navigationAnswer('https://datalayer.ai.evil.example/', ORIGIN)).toBe(
      'refuse'
    );
    expect(navigationAnswer('http://datalayer.ai/', ORIGIN)).toBe('refuse');
  });

  it('knows the callback by its exact scheme and host', () => {
    expect(isSignInCallback('datalayer://auth?token=t')).toBe(true);
    expect(isSignInCallback('datalayer://authx?token=t')).toBe(false);
    expect(isSignInCallback('https://datalayer.ai/auth')).toBe(false);
  });
});

describe('windowOpenAnswer', () => {
  it('keeps the landing in the view, sends the web outside, drops the rest', () => {
    expect(windowOpenAnswer('https://datalayer.ai/docs', ORIGIN)).toEqual({
      signInCallback: false,
      inView: true,
      outside: false,
    });
    expect(windowOpenAnswer('https://docs.example.com/', ORIGIN)).toEqual({
      signInCallback: false,
      inView: false,
      outside: true,
    });
    expect(windowOpenAnswer('mailto:hello@example.com', ORIGIN)).toEqual({
      signInCallback: false,
      inView: false,
      outside: true,
    });
    expect(windowOpenAnswer('datalayer://auth?token=t', ORIGIN)).toEqual({
      signInCallback: true,
      inView: false,
      outside: false,
    });
    expect(windowOpenAnswer('file:///etc/passwd', ORIGIN)).toEqual({
      signInCallback: false,
      inView: false,
      outside: false,
    });
    expect(windowOpenAnswer('javascript:alert(1)', ORIGIN)).toEqual({
      signInCallback: false,
      inView: false,
      outside: false,
    });
  });
});

describe('permissionAnswer', () => {
  it('answers the microphone for the landing origin and nothing else', () => {
    expect(
      permissionAnswer('media', 'https://datalayer.ai/studio/apps/x', ORIGIN, [
        'audio',
      ])
    ).toBe(true);
    expect(
      permissionAnswer('media', 'https://datalayer.ai/studio', ORIGIN)
    ).toBe(true);
    expect(
      permissionAnswer('media', 'https://datalayer.ai/studio', ORIGIN, [
        'audio',
        'video',
      ])
    ).toBe(false);
    expect(
      permissionAnswer('media', 'https://other.example/', ORIGIN, ['audio'])
    ).toBe(false);
    expect(
      permissionAnswer('notifications', 'https://datalayer.ai/studio', ORIGIN)
    ).toBe(false);
    expect(
      permissionAnswer('geolocation', 'https://datalayer.ai/studio', ORIGIN)
    ).toBe(false);
    expect(
      permissionAnswer('clipboard-read', 'https://datalayer.ai/studio', ORIGIN)
    ).toBe(false);
  });
});

describe('studioPath', () => {
  it('names the Home and an application’s Activity, and keeps an asked path to the Studio', () => {
    expect(studioPath({ kind: 'home' })).toBe('/studio');
    expect(studioPath({ kind: 'app-activity', uid: 'app 1' })).toBe(
      '/studio/apps/app%201?tab=activity'
    );
    expect(studioPathOf('/studio/apps/abc?tab=activity')).toBe(
      '/studio/apps/abc?tab=activity'
    );
    expect(studioPathOf('https://evil.example/')).toBeNull();
    expect(studioPathOf('//evil.example/')).toBeNull();
    expect(studioPathOf('')).toBeNull();
    expect(studioPathOf(42)).toBeNull();
  });
});

describe('the wiring', () => {
  const callback = vi.fn();
  const window = {
    contentView: { addChildView: vi.fn() },
    on: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createStudioView(window as never, callback);
  });

  it('creates the view in its own partition, hidden, on the Studio’s Home', () => {
    expect(electron.view.options).toEqual({
      webPreferences: {
        partition: STUDIO_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    expect(window.contentView.addChildView).toHaveBeenCalledWith(electron.view);
    expect(electron.view.setVisible).toHaveBeenCalledWith(false);
    expect(electron.contents.loadURL).toHaveBeenCalledWith(
      'https://datalayer.ai/studio'
    );
    expect(studioViewUrl()).toBe('https://datalayer.ai/studio');
  });

  it('lets the landing navigate, hands the callback over, refuses the rest — on navigation and on redirect', () => {
    for (const event of ['will-navigate', 'will-redirect']) {
      const prevent = vi.fn();
      electron.handlers[event](
        { preventDefault: prevent },
        'https://datalayer.ai/studio/apps/x'
      );
      expect(prevent).not.toHaveBeenCalled();
      electron.handlers[event](
        { preventDefault: prevent },
        'datalayer://auth?_xsrf=n&token=t'
      );
      expect(prevent).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenLastCalledWith(
        'datalayer://auth?_xsrf=n&token=t'
      );
      electron.handlers[event](
        { preventDefault: prevent },
        'https://github.com/'
      );
      expect(prevent).toHaveBeenCalledTimes(2);
    }
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('opens another origin outside, the landing in the view, and never a window', () => {
    expect(
      electron.handlers['window-open']({ url: 'https://docs.example.com/' })
    ).toEqual({ action: 'deny' });
    expect(electron.openExternal).toHaveBeenCalledWith(
      'https://docs.example.com/'
    );
    expect(
      electron.handlers['window-open']({ url: 'https://datalayer.ai/pricing' })
    ).toEqual({ action: 'deny' });
    expect(electron.contents.loadURL).toHaveBeenLastCalledWith(
      'https://datalayer.ai/pricing'
    );
    electron.handlers['window-open']({
      url: 'datalayer://auth?_xsrf=n&token=t',
    });
    expect(callback).toHaveBeenCalledWith('datalayer://auth?_xsrf=n&token=t');
    expect(electron.openExternal).toHaveBeenCalledTimes(1);
  });

  it('installs the permission handler on the partition with the two answers', () => {
    const grant = vi.fn();
    electron.handlers['permission']({}, 'media', grant, {
      requestingUrl: 'https://datalayer.ai/studio',
      mediaTypes: ['audio'],
    });
    expect(grant).toHaveBeenLastCalledWith(true);
    electron.handlers['permission']({}, 'notifications', grant, {
      requestingUrl: 'https://datalayer.ai/studio',
    });
    expect(grant).toHaveBeenLastCalledWith(false);
    electron.handlers['permission']({}, 'media', grant, {
      requestingUrl: 'https://evil.example/',
      mediaTypes: ['audio'],
    });
    expect(grant).toHaveBeenLastCalledWith(false);
  });

  it('shows the view at rounded bounds, hides it, opens a Studio path and clears the partition on sign-out', async () => {
    showStudioView({ x: 0.4, y: 56.6, width: 1399.5, height: 843.2 });
    expect(electron.view.setBounds).toHaveBeenCalledWith({
      x: 0,
      y: 57,
      width: 1400,
      height: 843,
    });
    expect(electron.view.setVisible).toHaveBeenLastCalledWith(true);
    hideStudioView();
    expect(electron.view.setVisible).toHaveBeenLastCalledWith(false);
    openInStudio('/studio/apps/abc?tab=activity');
    expect(electron.contents.loadURL).toHaveBeenLastCalledWith(
      'https://datalayer.ai/studio/apps/abc?tab=activity'
    );
    openInStudio('https://evil.example/');
    expect(electron.contents.loadURL).toHaveBeenLastCalledWith(
      'https://datalayer.ai/studio/apps/abc?tab=activity'
    );
    await clearStudioSession();
    expect(electron.partitionSession.clearStorageData).toHaveBeenCalled();
    expect(electron.contents.loadURL).toHaveBeenLastCalledWith(
      'https://datalayer.ai/studio'
    );
  });
});
