[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

[![Become a Sponsor](https://img.shields.io/static/v1?label=Become%20a%20Sponsor&message=%E2%9D%A4&logo=GitHub&style=flat&color=1ABC9C)](https://github.com/sponsors/datalayer)
[![Build](https://github.com/datalayer/desktop/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/datalayer/desktop/actions/workflows/build.yml)
[![Code Quality](https://github.com/datalayer/desktop/actions/workflows/code-quality.yml/badge.svg?branch=main)](https://github.com/datalayer/desktop/actions/workflows/code-quality.yml)
[![Netlify Status](https://api.netlify.com/api/v1/badges/c4c2d128-ca43-4bcd-8f74-e64b00ca59ba/deploy-status)](https://app.netlify.com/sites/datalayer-desktop/deploys)
[![Documentation](https://img.shields.io/badge/docs-TypeDoc-blue.svg)](https://datalayer-desktop.netlify.app)

# 🖥️ Datalayer Desktop

A powerful desktop application for data science and machine learning, powered by Jupyter notebooks and cloud computing.

## ✨ Features

- 📓 **Jupyter Notebooks** - Full notebook editing with real-time collaboration
- ☁️ **Cloud Computing** - Access powerful cloud runtimes for your computations
- 🚀 **Multiple Environments** - Choose from Python, R, Julia, and specialized ML environments
- 🔄 **Real-time Collaboration** - Work together on notebooks in real-time
- 🔐 **Secure** - Enterprise-grade security with encrypted connections
- 💾 **Auto-save** - Never lose your work with automatic saving

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
3. **Sign In** with your Datalayer account (or create a free account)
4. **Create or Open** a notebook to start working

## 📚 Documentation

- **User Guide**: [docs.datalayer.io](https://docs.datalayer.io)
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
- [CLAUDE.md](CLAUDE.md) - AI assistant context and troubleshooting guide

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
- [TESTING_QUICK_START.md](TESTING_QUICK_START.md) - Get started in 5 minutes
- [tests/README.md](tests/README.md) - Complete testing guide
- [TEST_SUMMARY.md](TEST_SUMMARY.md) - Implementation details

**Coverage Goals**: 70%+ overall, 90%+ critical path

### Recent Production Build Fixes (January 2025)

✅ **JupyterLab Services Loading**: Fixed production build module loading by handling Vite's `__require` wrapper
✅ **Lexical Collaboration**: Fixed WebSocket URL duplication for document collaboration
✅ **Notebook Execution**: Production builds now properly connect to runtimes and execute cells

See [CLAUDE.md](CLAUDE.md) for detailed technical information about these fixes.

## 📄 License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](LICENSE) file for details.

## 🏢 About Datalayer

[Datalayer](https://datalayer.io) is an AI platform for data analysis, making advanced data science accessible to everyone.

---

<p align="center">
  <strong>Ready to accelerate your data science?</strong><br>
  <a href="https://datalayer.app/">Get started with Datalayer today!</a>
</p>
