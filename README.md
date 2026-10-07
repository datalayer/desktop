[![Datalayer](https://images.datalayer.io/legacy/datalayer-25.svg)](https://datalayer.ai)

[![Become a Sponsor](https://img.shields.io/static/v1?label=Become%20a%20Sponsor&message=%E2%9D%A4&logo=GitHub&style=flat&color=1ABC9C)](https://github.com/sponsors/datalayer)

# ☰ 🖥️ Datalayer Desktop

A desktop application for data science and machine learning, with Jupyter notebooks and cloud computing.

## ✨ Features

### Core Capabilities

- 📓 **Jupyter Notebooks** - Full-featured notebook editing with live kernel execution.
- 📝 **Documents** - Rich text editor with embedded Jupyter cells for narrative documentation.
- 📚 **Spaces Library** - Browse and manage your notebooks and documents across Datalayer spaces
- ⚙️ **Runtime Management** - Create, monitor, and terminate cloud computing runtimes.
- 🌍 **Environment Selection** - Choose from Python, R, Julia, and specialized ML environments.

### Collaboration & Cloud

- ☁️ **Cloud Computing** - Access powerful cloud runtimes for your computations
- 🔄 **Real-time Collaboration** - Work together on Lexical documents with live editing (beta)
- 🔐 **Secure** - Enterprise-grade security with encrypted connections and token storage
- 💾 **Auto-save** - Never lose your work with automatic cloud synchronization

## 📥 Installation

### Download Pre-built Application

Download the latest version for your operating system:

- **macOS**: [Download .dmg](https://github.com/datalayer/desktop/releases/latest) (Universal - works on Intel & Apple Silicon)
- **Windows**: [Download .exe](https://github.com/datalayer/desktop/releases/latest)
- **Linux**: [Download .AppImage](https://github.com/datalayer/desktop/releases/latest)

### System Requirements

- **Operating System**: macOS 10.12+, Windows 10+, or Linux
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 500MB available space
- **Internet**: Required for cloud features

## 🚀 Getting Started

1. **Download and Install** the application for your operating system
2. **Launch** Datalayer Desktop from your Applications folder or Start menu
3. **Sign In** with your GitHub account through Datalayer authentication
4. **Select an Environment** - Choose your preferred runtime environment (Python, AI/ML, etc.)
5. **Browse Spaces** - Access your notebooks and documents from the library
6. **Create or Open** a notebook or document to start working
7. **Create Runtimes** - Spin up cloud computing resources when needed for execution

### Talk to your agent

An application you built and deployed in the Datalayer Agent Studio answers in Datalayer Desktop, in the **Your applications** tab.

1. Sign in to Datalayer.
2. In the Studio, open the application's **Ship** tab and turn on **Always on**: Desktop talks to the runtime the deployment is kept on.
3. Open the **Your applications** tab and pick the application. A deployment that cannot be talked to yet is listed with why, and cannot be picked.
4. Talk to it. The conversation is a session of the deployment, through the same session API its hosted page uses, in your name.

- **Approvals** - when one of its rules says _ask me first_, the request appears in the chat: approve or decline it there.
- **What it did** - under the chat, each tool it called as a line, e.g. `Support Desk → odoo-accounting: odoo_accounting_aged_balance`.
- **Your open notebook** - only when the application lets its host pass the page (`deployment.embedded.host.context: [page]` in its Appspec) and a rule lets `host_context` run: when its agent asks, it gets the notebook you last had in front (its path, its cell count and its selected cell, the source and the outputs as text, up to 20,000 characters). Nothing is read before it asks, and nothing when the application says otherwise.
- **Signed users** - an application that takes only a user its host's server signed (`deployment.embedded.host.user: signed`) is not opened in Desktop: Desktop does not hold the deployment's secret, and the tab says so.
- **Your token** - for the chat, the app's main process lends your Datalayer token only to the runtimes of the applications listed, to Tool Approvals and to the applications' Appspecs; the chat never asks for it.

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

### Testing (January 2025) 🧪

A comprehensive test suite has been implemented with **40+ test assertions** covering:

- **Unit Tests**: Components, utilities, and stores
- **Integration Tests**: IPC communication and service integration
- **E2E Tests**: Full user flows with Playwright

**Quick Start**:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
npm run test:ui       # Visual test runner
```

**Documentation**:
- [TESTING.md](TESTING.md) - Testing guide and quick start

**Coverage Goals**: 70%+ overall, 90%+ critical path

## 📄 License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](LICENSE.txt) file for details.

## ☰ About Datalayer

[Datalayer](https://datalayer.io) is an AI platform for data analysis, making advanced data science accessible to everyone.

---

<p align="center">
  <strong>Ready to accelerate your data science?</strong><br>
  <a href="https://datalayer.app/">Get started with Datalayer today!</a>
</p>
