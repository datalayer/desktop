# Changelog

## 0.1.1

- The appearance menu opens above the page (it opened beneath it).
- The Sessions page's place filter reads *All · Datalayer · Local*, each on one line.
- Sign in with a handle and password by default; the Run URL and an API token under *More options*.
- The menu is disabled until you sign in (except Help); Sessions comes first.
- The avatar falls back to your initial when its picture does not load; the appearance menu replaces the header's swatches.

## 0.1.0

A desktop that supports chat sessions.

- **Sessions**: your sessions on Datalayer and on this machine in one list; one chat for both places with *Resume*, *Switch agent…*, *Clone from here*, *Export*, *Import…*, *Reveal in Finder* and *Open in the Studio*.
- **A coding agent in your folder**: *File → Work in a folder…* starts Claude Code or Codex in a folder of yours on a local runtime (`loop`, installed on your machine at 1.5.70 or later: `uv tool install 'agent-runtimes[shield]'`), behind the Shield, with your folder's instructions file kept.
- **Waiting for you**: approvals answered in the chat; the OS notification, the dock badge and the tray for the sessions that are not in front.
- **Sign in** with GitHub or Google in a small sign-in window of the app; the typed token stays as the second way. No page of the app receives the token any more (the credentials bridge of 0.0.x is gone).
- **The Studio tab**: the app's own page — your applications, each with its Appspec (Build), its chat (Try), its sessions with their lineage (Activity) and its deployments paused and resumed (Deployments); the rest opens on datalayer.ai.
- **The menu**: File, Sessions, View and Help say what the app can do, with shortcuts.
- **The suite**: vitest 3.2; a Playwright e2e suite under `tests/e2e/` launched from the build with a stub `loop` and a stub sign-in, run in CI on Linux.
- `@datalayer/agent-runtimes` 1.5.73 (its `lib/` loads under Node, its files install whole on macOS and Windows) and the matching Datalayer packages.

0.1.0 is a development build: unsigned installers, no auto-update.

## 0.0.5

- *Your applications*: talk to a deployed application's agent, behind the `agentChatEnabled` setting, off by default.
- Datalayer packages from npm; React 19; CI without the core fork.
