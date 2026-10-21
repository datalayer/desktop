/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The shell's IPC shapes (DESKTOP DK-02, DK-03, DK-04): the Studio view,
 * sign-in and the menu, between the main process and the renderer.
 *
 * - `sign-in:start {provider}` → `SignInStarted`; `sign-in:failed`
 *   (main → renderer) carries the sentence a sign-in ended in;
 * - `studio:show {bounds}`, `studio:hide`, `studio:open {path}`;
 * - `menu-action` (main → renderer) carries a `MenuActionId`;
 *   `menu:state {sessionInFront}` tells the menu what the renderer shows.
 *
 * @module types/shell
 */

/** The providers IAM signs in with. */
export type SignInProvider = 'github' | 'google' | 'linkedin' | 'okta';

/** What `sign-in:start` answers: the page is showing, or why not. */
export type SignInStarted = { ok: true } | { ok: false; sentence: string };

/** Where the Studio view shows, in the window's content coordinates. */
export interface StudioBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The entries of the app menu the renderer answers (DK-04). */
export type MenuActionId =
  | 'work-in-folder'
  | 'new-datalayer-session'
  | 'import-session'
  | 'stop-local-runtime'
  | 'resume-last-session'
  | 'export-session'
  | 'open-in-studio'
  | 'show-sessions'
  | 'show-studio'
  | 'show-spaces'
  | 'show-runtimes'
  | 'show-environments'
  | 'sign-out';

/** What the renderer tells the menu about what it shows. */
export interface MenuRendererState {
  /** A session is open in the chat. */
  sessionInFront: boolean;
}

/** The sign-in API the preload exposes. */
export interface SignInAPI {
  /** Opens the provider's sign-in page in the Studio view. */
  start: (provider: SignInProvider) => Promise<SignInStarted>;
  /** The sentence a sign-in ended in, when it did not sign the person in. */
  onFailed: (callback: (sentence: string) => void) => void;
  removeFailedListener: () => void;
}

/** The Studio view API the preload exposes. */
export interface StudioAPI {
  /** Shows the view at the given bounds. */
  show: (bounds: StudioBounds) => Promise<void>;
  /** Hides the view; its page stays. */
  hide: () => Promise<void>;
  /** Sends the view to a path of the Studio (`/studio/apps/<uid>?tab=activity`). */
  open: (path: string) => Promise<void>;
}

/** The menu API the preload exposes, beside `electronAPI.onMenuAction`. */
export interface MenuAPI {
  /** Tells the menu what the renderer shows, so its entries enable. */
  setState: (state: MenuRendererState) => Promise<void>;
}
