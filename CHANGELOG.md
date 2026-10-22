# Changelog

## 0.1.4

- The tab is **Apps** (it was Studio): *View → Apps*, *Open in Apps* in the Sessions menu and a session's menu.
- An unreachable sign-in service at launch no longer signs you out: only a refused token (expired, 401, 403) is cleared, otherwise it is kept and checked again when the window asks.
- No green outline on a selected control: the segmented control's entry had a border after a click.
- The kernel indicator's details open below and to the right, not cut by the sidebar's edge.
- The chat's session menu has *Rules for this session…*.

## 0.1.3

- The profile menu opens on hover, as the appearance menu does; leaving it closes it.

## 0.1.2

- The appearance menu's overlay is no longer clipped by the header.
- 0.1.1's build failed on the place filter's labels; they are plain text again.

## 0.1.1 (not released: its build failed)

- The appearance menu opens above the page (it opened beneath it).
- The Sessions page's place filter reads *All · Datalayer · Local*, each on one line.
- Sign in with a handle and password by default; the Run URL and an API token under *More options*.
- The menu is disabled until you sign in (except Help); Sessions comes first.
- The avatar falls back to your initial when its picture does not load; the appearance menu replaces the header's swatches.

## 0.1.0

A desktop that supports chat sessions.

- **Sessions**: your sessions on Datalayer and on this machine in one list; one chat for both places with *Resume*, *Switch agent…*, *Clone from here*, *Export*, *Import…*, *Reveal in Finder* and *Open in Apps*.
- **A coding agent in your folder**: *File → Work in a folder…* starts Claude Code or Codex in a folder of yours on a local runtime (`loop`, installed on your machine at 1.5.70 or later: `uv tool install 'agent-runtimes[shield]'`), behind the Shield, with your folder's instructions file kept.
- **Waiting for you**: approvals answered in the chat; the OS notification, the dock badge and the tray for the sessions that are not in front.
- **Sign in** with GitHub or Google in a small sign-in window of the app; the typed token stays as the second way. No page of the app receives the token any more (the credentials bridge of 0.0.x is gone).
- **The Apps tab**: the app's own page — your applications, each with its Appspec (Build), its chat (Try), its sessions with their lineage (Activity) and its deployments paused and resumed (Deployments); the rest opens on datalayer.ai.
- **The menu**: File, Sessions, View and Help say what the app can do, with shortcuts.
- **The suite**: vitest 3.2; a Playwright e2e suite under `tests/e2e/` launched from the build with a stub `loop` and a stub sign-in, run in CI on Linux.
- `@datalayer/agent-runtimes` 1.5.73 (its `lib/` loads under Node, its files install whole on macOS and Windows) and the matching Datalayer packages.

0.1.0 is a development build: unsigned installers, no auto-update.

## 0.0.5

- *Your applications*: talk to a deployed application's agent, behind the `agentChatEnabled` setting, off by default.
- Datalayer packages from npm; React 19; CI without the core fork.
