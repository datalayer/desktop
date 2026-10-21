[![Datalayer](https://images.datalayer.io/legacy/datalayer-25.svg)](https://datalayer.ai)

[![Become a Sponsor](https://img.shields.io/static/v1?label=Become%20a%20Sponsor&message=%E2%9D%A4&logo=GitHub&style=flat&color=1ABC9C)](https://github.com/sponsors/datalayer)

# ☰ 🖥️ Datalayer Desktop

A desktop that supports chat sessions: the sessions you opened on Datalayer and on this machine in one list, each one resumed, swapped to another agent, cloned, exported and imported; a new one started with an application of yours on Datalayer, or with a coding agent (Claude Code, Codex) in a folder of yours, under the Shield's rules, its approvals answered in the app and said by your OS. The Datalayer Agent Studio comes embedded. Notebooks and documents on cloud runtimes stay as they were.

## ✨ What it does

### Sessions

- **One list, two places.** Your sessions on Datalayer (the ones the Studio's Activity lists) and the sessions on this machine, marked, grouped by place and application, filtered by state and title.
- **One chat.** A session of either place opens in the app's own chat, with the thread's `⋯` menu: *Resume*, *Switch agent…*, *Clone from here*, *Export*, *Import…*, and the app's own *Reveal in Finder* and *Open in the Studio*.
- **A coding agent in your folder.** *File → Work in a folder…* picks a folder, a coding agent and an application; the agent runs in that folder, behind the Shield, with your folder's own `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` or `.goosehints` kept.
- **Waiting for you.** When a rule says *ask me first*, the request appears whole in the chat — a write's diff, a command — and is approved or declined there. With another window in front, your OS shows a notification naming the application and the action's class (never its arguments), the dock badge counts the sessions waiting, the tray lists them.
- **Nothing syncs silently.** A session moves between the places by *Export* (a `<uid>.session.jsonl` file where you choose) and *Import…* (the place asked each time).

### The Studio, embedded

The **Studio** tab is the Datalayer web app itself, signed in with the app: Build, Try, Validate, Ship, Activity and Usage as on the site, voice and avatars included. Nothing of it is rebuilt here.

### Notebooks, documents, runtimes

- 📓 **Jupyter Notebooks** - Full-featured notebook editing with live kernel execution.
- 📝 **Documents** - Rich text editor with embedded Jupyter cells for narrative documentation.
- 📚 **Spaces Library** - Browse and manage your notebooks and documents across Datalayer spaces.
- ⚙️ **Runtime Management** - Create, monitor, and terminate cloud computing runtimes.
- 🌍 **Environment Selection** - Choose from Python, R, Julia, and specialized ML environments.

## 📥 Installation

### Download the application

Download the latest version for your operating system from the [releases page](https://github.com/datalayer/desktop/releases/latest):

- **macOS**: `.dmg` (Universal - works on Intel & Apple Silicon)
- **Windows**: `.exe`
- **Linux**: `.AppImage`

**0.1.0 is a development build.** The installers are not signed: on macOS, right-click the app and choose *Open* the first time; on Windows, *More info → Run anyway*. The app does not update itself yet: download the next version from the releases page.

### A coding agent on your machine

To work with a coding agent in a folder of yours, the app needs `loop` — the Datalayer agent runtime — installed on your machine, with the Shield, at **1.5.70 or later**:

```bash
uv tool install 'agent-runtimes[shield]'
```

(or `pipx install 'agent-runtimes[shield]'`). The app finds it on your `PATH`, in `uv tool`'s and `pipx`'s folders, or at the path you set in its settings; an older `loop`, or none, is refused in a sentence naming this line. Nothing is bundled: the same `loop` serves your terminal (`loop sessions list`) and the Datalayer extension for VS Code.

For the agent itself (Claude Code, Codex), the app checks what the agent needs — Node, the agent's adapter, its credential (`ANTHROPIC_API_KEY` for Claude Code, from your environment or typed once into the app's keychain, never shown or logged) — and offers to install the missing part, showing the command whole before it runs.

### System Requirements

- **Operating System**: macOS 10.12+, Windows 10+, or Linux
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 500MB available space
- **Internet**: Required for cloud features

## 🚀 Getting Started

1. **Download and Install** the application for your operating system.
2. **Launch** Datalayer Desktop.
3. **Sign in** - *Sign in with GitHub* or *Sign in with Google* opens Datalayer's sign-in inside the app; the app and the embedded Studio are signed in together. A token typed with its Run URL (*or with a token*, under the buttons) is the second way, for a self-hosted Datalayer or a machine without the browser flow. Your token is held by the app's main process only and kept in your OS keychain; no page of the app ever receives it.
4. **Sessions** - the app opens on your sessions: the ones on Datalayer, and *No session on this machine yet — File → Work in a folder…* until you open a folder.
5. **Work in a folder** - *File → Work in a folder…*, pick a folder, Claude Code and the blank harness application: the session's first line says your folder's instructions file is kept. Ask for an edit: the diff appears in the chat and the file changes in your folder. When a rule asks you first, decide in the chat.
6. **A session on Datalayer** - *File → New session on Datalayer…* lists your applications kept always on (turn on *Always on* in the application's Ship tab in the Studio); pick one and talk to it in the same chat.
7. **Come back** - quit and reopen: the local session is listed *paused* with its folder and resumes on it. `loop sessions list` in a terminal and VS Code's Sessions view show the same sessions; a session started in VS Code appears here as *open in VS Code or a terminal* until VS Code pauses it.

### Where things live

- **Sessions on this machine**: `~/.datalayer/sessions/<uid>/entries.jsonl`, one store for every local runtime on the machine (the app's, your terminal's, VS Code's).
- **The app's settings and keychain entries**: Desktop's user data folder — `~/.config/Datalayer Desktop` on Linux, `~/Library/Application Support/Datalayer Desktop` on macOS, `%APPDATA%\Datalayer Desktop` on Windows.
- **An exported session**: the `<uid>.session.jsonl` file you chose; credentials never travel with it.

### The menu

*File*: Work in a folder…, New session on Datalayer…, Import a session…, Stop the local runtime. *Sessions*: Resume last, Export…, Open in the Studio. *View*: Sessions, Studio, Spaces, Agents, Environments, the developer tools. *Help*: Datalayer docs, Report a problem. *Sign out* is in the app menu on macOS and under *File* elsewhere. The shortcuts are in the menu.

## 🧑‍💻 Running from source

```bash
git clone https://github.com/datalayer/desktop.git
cd desktop
git checkout feat/agent-chat-apps   # until 0.1.0 is released
npm install
npm start                            # development mode, hot reload, DevTools
```

`DATALAYER_IAM_URL` points the app at another Datalayer; `DATALAYER_LANDING_URL` at another Studio (the development server, `http://localhost:3063`, is used in development by default).

### Tests

```bash
npm run test:unit     # vitest: the main process's services, the pure modules, the renderer's pages
npm run build         # the app's bundle (not an installer)
npm run test:e2e      # Playwright: the app launched from its build with a stub `loop` and a stub sign-in
```

The e2e suite needs no Datalayer account, no Python and no model: `tests/mocks/loop` stands in for `loop`, `tests/mocks/iam.ts` for Datalayer's sign-in and the Studio. On a Linux box without a display: `xvfb-run -a npm run test:e2e`. Both suites run in CI on every push.

### The pass before 0.1.0

What is checked on a real machine, with Claude Code and a funded key, before the version is tagged:

1. `uv tool install 'agent-runtimes[shield]'` at 1.5.70 or later; an older `loop` is refused in a sentence.
2. `npm start` on the branch, or the development build from the GitHub pre-release.
3. *Sign in with GitHub* inside the app; the app lands on **Sessions** with the sessions Datalayer's Activity lists, and *No session on this machine yet*.
4. *File → Work in a folder…* on a folder **with** its own `CLAUDE.md`, Claude Code, the blank harness application: the session's first line says the file is kept.
5. A turn edits a file: the diff row in the chat, the file changed in the folder.
6. A `git push` asked: with another window in front, the OS notification names the class and not the arguments, the badge says 1, the chat shows the request whole; *Decline* from the chat, the agent told.
7. *Switch agent…* to Codex, the sentence shown and the agent told; *Clone from here* at turn 1 gives a *paused* row; *Export* to a file; *Import…* of that file with *on Datalayer* picked gives a new *paused* row on Datalayer, resumed in the same chat.
8. A session on Datalayer from the web's Activity opened from the list and resumed.
9. The app quit and reopened: the local session listed *paused* with its folder, resumed on the folder's runtime; `loop sessions list` and VS Code's Sessions view show the same local sessions; a session started in VS Code appears as *open in VS Code or a terminal* until VS Code pauses it.
10. Then the tag `v0.1.0`.

### A coding agent in your folder

Datalayer Desktop runs a coding agent (Claude Code, Codex) in a folder of yours, under the Shield's rules, as a **session** on this machine. It needs `loop` from Agent Runtimes on your machine, at 1.5.70 or later, installed once:

```bash
uv tool install 'agent-runtimes[shield]'
```

Desktop looks for `loop` on your `PATH`, then under `uv tool`'s and `pipx`'s folders; to point it elsewhere, put `{ "loopPath": "/path/to/loop" }` in `settings.json` in Desktop's user data folder (`~/.config/Datalayer Desktop` on Linux, `~/Library/Application Support/Datalayer Desktop` on macOS, `%APPDATA%\Datalayer Desktop` on Windows). When `loop` is missing or too old, Desktop says so and names the install line; nothing is bundled.

- **One runtime per folder.** For each folder you work in, Desktop starts its own `loop serve` on a port of this machine and stops it when you quit or choose **File → Stop the local runtime**. At launch it starts the runtime of the last folder you worked in, so your sessions on this machine are listed right away; the last ten folders are remembered.
- **Where sessions live.** On this machine, in `~/.datalayer/sessions` — the same store `loop sessions …` in a terminal and the Datalayer VS Code extension use, so a session started there is listed here too (one that is still open elsewhere says so, and is resumed here once it is paused). On Datalayer, in your account; the list shows both places.
- **What the agent gets.** A trimmed environment (your `PATH`, home and locale, never your whole shell), the folder as its workspace, and only the credential its harness declares — `ANTHROPIC_API_KEY` for Claude Code — taken from your environment first, else from the key you give Desktop once, kept encrypted in the OS keychain (never in settings, never shown, never logged). Desktop says which it used. A machine without an OS keychain keeps nothing: set the key in your environment instead. Signed in, the agent also gets your Datalayer token and IAM address so the Shield can read your organization's policy.
- **Before the agent starts**, Desktop checks what the harness needs — Node and its version, git, the pinned adapter, the credential — and offers `agent-shield setup --harness <id>` for what is missing, the command shown whole before it runs.
- **Approvals.** When a rule says _ask me first_, the request appears whole in the chat, and you approve or decline it there — on this machine over the runtime's own channel, on Datalayer through Tool Approvals; one answered elsewhere says so.
- **Desktop tells you.** When a session not in front asks for a decision, asks you a question, finishes a turn or loses its runtime, the OS shows a notification that names the application, the action and its class (`execute`, `write`, …) and never the arguments; clicking it opens that session. While Desktop is the frontmost window the dock icon bounces or the taskbar flashes instead. The dock badge and the tray count the sessions waiting for you. A sound is off unless you put `{ "attentionSound": true }` in `settings.json`.

## 📚 Documentation

- **User Guide**: [datalayer.ai/docs](https://datalayer.ai/docs)
- **API Documentation**: [datalayer-desktop.netlify.app](https://datalayer-desktop.netlify.app)

## 🤝 Community & Support

- **Issues**: [GitHub Issues](https://github.com/datalayer/desktop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/datalayer/desktop/discussions)
- **Discord**: [Join our Discord](https://discord.gg/datalayer)

## 🔧 For Developers

If you want to contribute or build from source, please see:

- [DEVELOPMENT.md](DEVELOPMENT.md) - Development setup and architecture
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [RELEASE.md](RELEASE.md) - Release and packaging instructions
- [AGENTS.md](AGENTS.md) - Coding agent instructions and troubleshooting guide

## 📄 License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](LICENSE.txt) file for details.

## ☰ About Datalayer

[Datalayer](https://datalayer.io) is an AI platform for data analysis, making advanced data science accessible to everyone.

---

<p align="center">
  <strong>Ready to accelerate your data science?</strong><br>
  <a href="https://datalayer.app/">Get started with Datalayer today!</a>
</p>
