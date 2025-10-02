# Datalayer Desktop 0.0.1

First official release! 🎉

## ✨ Features

### Core Functionality
- **Jupyter Notebook Editor**: Full-featured notebook editing with real-time kernel execution
- **Lexical Document Editor**: Rich text editing with collaborative features
- **Datalayer Platform Integration**: Seamless connection to Datalayer cloud services

### Authentication & Access
- GitHub OAuth authentication
- Automatic session management
- Multi-workspace support across different Datalayer spaces

### Notebook Capabilities
- Execute Python, R, and Julia code cells with live output
- Full kernel management (start, stop, restart)
- IPyWidgets interactive widget support
- Cell execution history and outputs
- Markdown cells with rich formatting
- Code cells with syntax highlighting

### Lexical Editor
- Rich text formatting (bold, italic, headings, lists)
- Code blocks with syntax highlighting
- Real-time collaborative editing (beta)
- Jupyter cell execution within documents
- Export capabilities

### Platform Features
- Browse and navigate Datalayer spaces
- Open notebooks and lexical documents from cloud
- Create and manage cloud runtimes
- Automatic file synchronization
- Environment selection (Python, AI/ML)

## 📥 Installation

### macOS (Universal - Intel & Apple Silicon)
1. Download `Datalayer-Desktop-*.dmg`
2. Open the DMG file
3. Drag **Datalayer Desktop** to your Applications folder
4. **First launch**: Right-click the app → "Open" to bypass Gatekeeper

### Windows
1. Download `Datalayer-Desktop-Setup-*.exe`
2. Run the installer
3. Follow the installation wizard
4. **First launch**: Click "More info" → "Run anyway" if SmartScreen appears

### Linux

**AppImage (Recommended - Works on all distributions)**
```bash
chmod +x Datalayer-Desktop-*.AppImage
./Datalayer-Desktop-*.AppImage
```

**Debian/Ubuntu**
```bash
sudo dpkg -i datalayer-desktop_*_amd64.deb
```

**Fedora/RHEL/CentOS**
```bash
sudo rpm -i datalayer-desktop-*.x86_64.rpm
```

## ⚠️ Known Limitations

- Unsigned builds: Users will see security warnings on first launch (see installation instructions above)
- Datalayer account required for cloud features
- Large notebooks (>100 cells) may have initial load delays
- Some notebook extensions not yet supported

## 💻 System Requirements

| Platform | Minimum | Recommended |
|----------|---------|-------------|
| **macOS** | 10.15 (Catalina) | 12.0 (Monterey) or later |
| **Windows** | Windows 10 (64-bit) | Windows 11 |
| **Linux** | GLIB 2.31+, GTK 3 | Recent Ubuntu/Fedora |
| **RAM** | 4 GB | 8 GB or more |
| **Disk** | 500 MB free | 1 GB free |

## 🚀 Getting Started

1. **Launch the app**
2. **Login with GitHub** - Click "Login to Datalayer"
3. **Browse your spaces** - View notebooks and documents in the sidebar
4. **Open a notebook** - Double-click to start editing
5. **Create a runtime** - Select environment and start coding!

## 🔄 Auto-Updates

The app includes built-in update checking:
- **macOS/Windows**: Automatic update notifications
- **Linux**: Manual download or package manager updates

## 🐛 Known Issues

- Auto-update not available for first install (will work from v0.0.2+)
- Collaboration features are in beta
- Some widgets may not render in offline mode

## 📚 Documentation

- User Guide: [Coming soon]
- API Documentation: https://vscode-datalayer.netlify.app
- GitHub Repository: https://github.com/datalayer/desktop

## 🛠️ Troubleshooting

**App won't open on macOS**
- Right-click → "Open" (first launch only)
- Or: System Settings → Privacy & Security → "Open Anyway"

**SmartScreen warning on Windows**
- Click "More info" → "Run anyway"

**Linux: Missing dependencies**
```bash
# Ubuntu/Debian
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0

# Fedora
sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-atk
```

## 🗺️ Roadmap

- [ ] Plugin system for extensions
- [ ] Offline notebook support
- [ ] Git integration
- [ ] Dark theme improvements
- [ ] Performance optimizations for large notebooks
- [ ] Additional kernel support (Scala, Go, etc.)

See our [GitHub Issues](https://github.com/datalayer/desktop/issues) for full roadmap.

## 💬 Support & Feedback

- **Bug Reports**: [GitHub Issues](https://github.com/datalayer/desktop/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/datalayer/desktop/discussions)
- **Documentation**: [GitHub Wiki](https://github.com/datalayer/desktop/wiki)

## 🙏 Acknowledgments

Built with:
- [Electron](https://electronjs.org/)
- [React](https://reactjs.org/)
- [JupyterLab](https://jupyterlab.readthedocs.io/)
- [@datalayer/jupyter-react](https://github.com/datalayer/jupyter-react)

---

**Thank you for trying Datalayer Desktop!** 🚀

*Note: This is an early release. We appreciate your patience with any issues and welcome your feedback!*
