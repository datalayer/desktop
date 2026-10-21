/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

// @vitest-environment node

/**
 * The provider sign-in's window (DESKTOP DK-03): the navigation policy
 * (the callback caught, the web followed, anything else refused); the
 * wiring — a window of its own over the main one in the `sign-in`
 * partition, IAM's page loaded, the callback caught on either navigation
 * event or a window-open and the window closed after, a close by the
 * person said, a close by the app not, the partition cleared.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => {
  const windows: Array<{
    options: Record<string, unknown>;
    handlers: Record<string, (...args: unknown[]) => unknown>;
    destroyed: boolean;
    loadURL: ReturnType<typeof vi.fn>;
    close: () => void;
  }> = [];
  const partition = { clearStorageData: vi.fn(async () => undefined) };
  return { windows, partition, openExternal: vi.fn() };
});

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(function (options: Record<string, unknown>) {
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const made = {
      options,
      handlers,
      destroyed: false,
      loadURL: vi.fn(async () => undefined),
      close: () => {
        if (made.destroyed) {
          return;
        }
        made.destroyed = true;
        handlers.closed?.();
      },
    };
    electron.windows.push(made);
    return {
      webContents: {
        on: (event: string, handler: (...args: unknown[]) => unknown) => {
          handlers[event] = handler;
        },
        setWindowOpenHandler: (handler: (...args: unknown[]) => unknown) => {
          handlers['window-open'] = handler;
        },
        loadURL: made.loadURL,
        getURL: () => 'https://iam.example/page',
      },
      on: (event: string, handler: (...args: unknown[]) => unknown) => {
        handlers[event] = handler;
      },
      isDestroyed: () => made.destroyed,
      close: made.close,
    };
  }),
  session: { fromPartition: vi.fn(() => electron.partition) },
  shell: { openExternal: electron.openExternal },
}));

vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  SIGN_IN_PARTITION,
  closeSignInWindow,
  openSignInWindow,
  signInNavigationAnswer,
} from '../sign-in-window';

const CALLBACK = 'datalayer://auth?_xsrf=n&token=t';

describe('signInNavigationAnswer', () => {
  it('catches the callback, follows the web, refuses the rest', () => {
    expect(signInNavigationAnswer(CALLBACK)).toBe('sign-in-callback');
    expect(signInNavigationAnswer('datalayer://auth')).toBe('sign-in-callback');
    expect(signInNavigationAnswer('https://github.com/login')).toBe('allow');
    expect(signInNavigationAnswer('http://127.0.0.1:9/stub')).toBe('allow');
    expect(signInNavigationAnswer('datalayer://authx')).toBe('refuse');
    expect(signInNavigationAnswer('file:///etc/passwd')).toBe('refuse');
    expect(signInNavigationAnswer('not a url')).toBe('refuse');
  });
});

describe('the window', () => {
  beforeEach(() => {
    closeSignInWindow();
    electron.windows.length = 0;
    electron.partition.clearStorageData.mockClear();
    electron.openExternal.mockClear();
  });

  const open = () => {
    const onCallback = vi.fn();
    const onClosed = vi.fn();
    openSignInWindow('https://iam.example/authz', null, {
      onCallback,
      onClosed,
    });
    return { onCallback, onClosed, made: electron.windows[0] };
  };

  it('opens IAM’s page in a sandboxed window of its own partition', () => {
    const { made } = open();
    const prefs = made.options.webPreferences as Record<string, unknown>;
    expect(prefs).toMatchObject({
      partition: SIGN_IN_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    });
    expect(SIGN_IN_PARTITION.startsWith('persist:')).toBe(false);
    expect(made.loadURL).toHaveBeenCalledWith('https://iam.example/authz');
  });

  it('catches the callback on a navigation, closes and clears, once', () => {
    const { onCallback, onClosed, made } = open();
    const follow = { preventDefault: vi.fn() };
    made.handlers['will-navigate'](follow, 'https://github.com/login');
    expect(follow.preventDefault).not.toHaveBeenCalled();

    const caught = { preventDefault: vi.fn() };
    made.handlers['will-redirect'](caught, CALLBACK);
    expect(caught.preventDefault).toHaveBeenCalled();
    expect(onCallback).toHaveBeenCalledWith(CALLBACK);
    expect(made.destroyed).toBe(true);
    expect(onClosed).not.toHaveBeenCalled();
    expect(electron.partition.clearStorageData).toHaveBeenCalled();
  });

  it('catches the callback opened as a window; a web link goes to the OS browser', () => {
    const { onCallback, made } = open();
    expect(
      made.handlers['window-open']({ url: 'https://docs.example' })
    ).toEqual({ action: 'deny' });
    expect(electron.openExternal).toHaveBeenCalledWith('https://docs.example');
    made.handlers['window-open']({ url: CALLBACK });
    expect(onCallback).toHaveBeenCalledWith(CALLBACK);
  });

  it('says a close by the person, and not a close by the app', () => {
    const first = open();
    first.made.close();
    expect(first.onClosed).toHaveBeenCalledTimes(1);

    electron.windows.length = 0;
    const second = open();
    closeSignInWindow();
    expect(second.made.destroyed).toBe(true);
    expect(second.onClosed).not.toHaveBeenCalled();
  });

  it('a new sign-in replaces the window open without ending it as a close', () => {
    const first = open();
    electron.windows.length = 0;
    open();
    expect(first.made.destroyed).toBe(true);
    expect(first.onClosed).not.toHaveBeenCalled();
  });
});
