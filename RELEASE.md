# Release & Distribution Guide

# Desktop App - Quick Release Guide

## 🚀 Release in 2 Steps

```bash
# 1. Update version and create tag
npm version patch  # or minor, or major

# 2. Push to trigger automated build
git push origin main --follow-tags
```

**That's it!** GitHub Actions will:
- ✅ Build for macOS, Windows, Linux (30-45 minutes)
- ✅ Create installers (DMG, EXE, AppImage, deb, rpm)
- ✅ Upload to GitHub Releases
- ✅ Generate changelog automatically

## 📦 No Setup Required

The workflow is ready to use immediately. **No secrets, no certificates, no configuration needed.**

Builds are unsigned, which is perfect for:
- Open source distribution
- GitHub Releases
- Community downloads

## 👥 User Installation

Users can easily bypass security warnings:

**macOS**: Right-click → "Open" (first launch only)
**Windows**: Click "More info" → "Run anyway"
**Linux**: No warnings, works immediately

## 📊 What Gets Built

| Platform | Files | Size |
|----------|-------|------|
| macOS | `.dmg`, `.zip` | 200-300 MB |
| Windows | `.exe` | 150-250 MB |
| Linux | `.AppImage`, `.deb`, `.rpm` | 150-250 MB |

## 🔍 Monitor Progress

1. Push the tag
2. Go to **GitHub** → **Actions** tab
3. Watch "Release Desktop App" workflow
4. Check **Releases** page when done

## 📝 Version Types

```bash
npm version patch      # 0.0.1 → 0.0.2 (bug fixes)
npm version minor      # 0.0.2 → 0.1.0 (new features)
npm version major      # 0.1.0 → 1.0.0 (breaking changes)
npm version prerelease --preid=beta  # 0.0.2 → 0.0.3-beta.0
```

## ❓ Need More Details?

- Manual build instructions
- Code signing (optional, advanced)
- Troubleshooting
- Build configuration
- Distribution channels

## 📦 Quick Start (Automated Release)

The easiest way to release:

```bash
# Update version and create tag
npm version patch  # or minor, or major

# Push to trigger automated release
git push origin main --follow-tags
```

**GitHub Actions automatically:**
- ✅ Builds for macOS (Universal), Windows, and Linux
- ✅ Creates installers (DMG, EXE, AppImage, deb, rpm)
- ✅ Runs tests and type checking
- ✅ Signs applications (if certificates configured)
- ✅ Creates GitHub Release with all installers
- ✅ Generates changelog from commits

**Build time**: ~30-45 minutes (3 platforms in parallel)

---

## 🔧 One-Time Setup for Automated Releases

**No setup required!** The workflow is ready to use immediately.

> **Note**: Builds are **unsigned** (no code signing). This is fine for GitHub Releases and open source distribution. Users will see security warnings on first launch, but the apps work perfectly.

### How Users Can Run Unsigned Apps

- **macOS**: Right-click app → "Open" (or System Settings → Privacy & Security → "Open Anyway")
- **Windows**: Click "More info" → "Run anyway" when SmartScreen warning appears
- **Linux**: No signing required, apps run without warnings

### Want Code Signing Later?

If you need signed builds for enterprise distribution or app stores, see the [Code Signing](#-code-signing) section below for detailed instructions.

---

## 🚀 Release Process

### Option 1: Automated Release (Recommended)

```bash
# Step 1: Update version
npm version patch  # Bug fixes (0.0.1 → 0.0.2)
npm version minor  # New features (0.0.2 → 0.1.0)
npm version major  # Breaking changes (0.1.0 → 1.0.0)

# Step 2: Push
git push origin main --follow-tags

# Step 3: Monitor
# Go to GitHub Actions tab and watch the "Release Desktop App" workflow
```

### Option 2: Manual Release

#### Prerequisites
- Node.js 22+ installed
- All dependencies installed (`npm install`)
- Clean working directory

#### Build Steps

```bash
# Clean previous builds
rm -rf dist dist-electron node_modules/.vite

# Install fresh dependencies
npm ci

# Build application
npm run build
```

#### Platform-Specific Packaging

**macOS:**
```bash
# Universal (Intel + Apple Silicon)
npm run dist:mac-universal

# Intel only
npm run dist:mac-intel

# Apple Silicon only
npm run dist:mac-arm
```

**Windows:**
```bash
npm run dist:win
```

**Linux:**
```bash
npm run dist:linux
```

#### Output Files
- **macOS**: `.dmg`, `.zip` in `dist-electron/`
- **Windows**: `.exe` in `dist-electron/`
- **Linux**: `.AppImage`, `.deb`, `.rpm` in `dist-electron/`

---

## 📊 Build Artifacts

| Platform | Files | Size | Architecture | Auto-Update |
|----------|-------|------|--------------|-------------|
| **macOS** | DMG, ZIP | 200-300 MB | Universal (Intel + ARM64) | Yes |
| **Windows** | EXE | 150-250 MB | x64 | Yes |
| **Linux** | AppImage, deb, rpm | 150-250 MB | x64 | Manual/Package Manager |

---

## 📝 Version Management

### Semantic Versioning

We follow [SemVer 2.0.0](https://semver.org/):

| Type | Example | When to Use |
|------|---------|-------------|
| **Major** | 1.0.0 → 2.0.0 | Breaking changes |
| **Minor** | 1.0.0 → 1.1.0 | New features, backwards compatible |
| **Patch** | 1.0.0 → 1.0.1 | Bug fixes |
| **Pre-release** | 1.0.0 → 1.1.0-beta.0 | Testing versions |

### Updating Version

```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.1 -> 1.1.0
npm version major  # 1.1.0 -> 2.0.0
npm version prerelease --preid=beta  # 1.1.0 -> 1.1.1-beta.0
```

This automatically:
- Updates `package.json`
- Creates git commit
- Creates git tag

---

## 🔐 Code Signing (Optional - Advanced)

> **Note**: Code signing is **not required** for GitHub Releases. This section is only for enterprise distribution or app store submission.

### Why Skip Code Signing?

- **Complexity**: Requires Apple Developer account ($99/year) and certificate management
- **Maintenance**: Certificates expire and need renewal
- **Works Without**: Apps function perfectly unsigned, users just click an extra warning

### When You Might Need It

- Enterprise distribution to many users
- Submitting to Mac App Store or Microsoft Store
- Corporate environments with strict security policies

### macOS Code Signing (Advanced)

**Requirements:**
- Apple Developer account ($99/year)
- Developer ID Application certificate
- Notarization setup

**Quick Setup:**
```bash
# Set environment variables
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"
```

**Verification:**
```bash
codesign --verify --verbose dist-electron/*.app
spctl --assess --verbose dist-electron/*.app
```

### Windows Code Signing (Advanced)

**Requirements:**
- Code signing certificate ($200-500/year)
- `.pfx` certificate file

**Setup:**
```bash
export CSC_LINK="path/to/cert.pfx"
export CSC_KEY_PASSWORD="password"
```

**To disable signing (default):**
Set `CSC_IDENTITY_AUTO_DISCOVERY=false` or don't provide certificate files.

---

## ⚙️ Build Configuration

### electron-builder.json

```json
{
  "appId": "io.datalayer.desktop",
  "productName": "Datalayer Desktop",
  "copyright": "Copyright © 2025 Datalayer, Inc.",
  "directories": {
    "output": "dist-electron",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*"
  ],
  "mac": {
    "category": "public.app-category.developer-tools",
    "icon": "build/icon.icns",
    "target": "dmg",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "win": {
    "target": "nsis",
    "icon": "build/icon.ico"
  },
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "icon": "build/icon.png",
    "category": "Development"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  },
  "publish": {
    "provider": "github",
    "owner": "datalayer",
    "repo": "desktop"
  }
}
```

---

## 🔄 Auto-Updates

The app includes built-in auto-update support via `electron-updater`.

### How It Works

1. App checks for updates on startup
2. Downloads new version in background
3. Notifies user when ready
4. Installs on next restart

### Platform Support

- **macOS**: Automatic download and install
- **Windows**: Automatic download and install
- **Linux AppImage**: Manual download
- **Linux deb/rpm**: Package manager updates

### Configuration

Updates are configured in `electron-builder.json`:

```json
{
  "publish": {
    "provider": "github",
    "owner": "datalayer",
    "repo": "desktop"
  }
}
```

---

## 🧪 Testing Packages

### Local Testing

#### macOS
```bash
# Open the app
open dist-electron/*.app

# Or install DMG
open dist-electron/*.dmg
```

#### Windows
```bash
# Run installer
dist-electron\*.exe
```

#### Linux
```bash
# Run AppImage
chmod +x dist-electron/*.AppImage
./dist-electron/*.AppImage

# Or install package
sudo dpkg -i dist-electron/*.deb  # Debian/Ubuntu
sudo rpm -i dist-electron/*.rpm   # Fedora/RHEL
```

### Testing Checklist

- [ ] App launches without errors
- [ ] Authentication works (GitHub OAuth)
- [ ] Can open notebooks from Datalayer
- [ ] Can create and edit lexical documents
- [ ] Kernel execution works
- [ ] Collaboration features work
- [ ] Menus and shortcuts function
- [ ] Window controls work (minimize, maximize, close)
- [ ] Auto-update check works
- [ ] Uninstaller removes all files

---

## 📤 Publishing Releases

### GitHub Releases (Automated)

The release workflow automatically:
1. Builds for all platforms
2. Creates installers
3. Uploads to GitHub Release
4. Generates changelog

### Manual GitHub Release

If automation fails:

1. **Create Tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Create Release on GitHub**
   - Go to Releases → "Draft a new release"
   - Select the tag
   - Write release notes
   - Upload built packages from `dist-electron/`
   - Publish

### Release Notes Template

```markdown
# Version X.Y.Z

## ✨ New Features
- Feature 1 description
- Feature 2 description

## 🐛 Bug Fixes
- Fix 1 description
- Fix 2 description

## 🔧 Improvements
- Performance improvement 1
- UI/UX improvement 2

## 📦 Dependencies
- Updated @datalayer/jupyter-react to v1.1.7
- Updated electron to v32.0.0

## 💔 Breaking Changes
- Breaking change description (if any)

## 📥 Downloads

Choose the appropriate installer for your platform:
- **macOS**: `.dmg` (Universal - Intel & Apple Silicon)
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` (portable), `.deb` (Debian/Ubuntu), `.rpm` (Fedora/RHEL)

### Installation Instructions

**macOS**: Open DMG, drag to Applications, right-click → Open first time
**Windows**: Run .exe and follow installation wizard
**Linux AppImage**: `chmod +x *.AppImage && ./*.AppImage`
```

---

## 📦 Distribution Channels

### Primary Channel
- **GitHub Releases** (https://github.com/datalayer/desktop/releases)
- Direct downloads for all platforms
- Auto-update source

### Future Channels

#### macOS (Homebrew)
```bash
brew tap datalayer/desktop
brew install datalayer-desktop
```

#### Windows (Chocolatey)
```bash
choco install datalayer-desktop
```

#### Linux (Snap)
```bash
snap install datalayer-desktop
```

---

## 🛠️ Troubleshooting

### Build Issues

**Error**: `No identity found for signing` (macOS)

**Solution**:
- Check certificate is installed in Keychain
- Verify `APPLE_CERTIFICATE_BASE64` secret
- Test without signing: Set `mac.identity: null`

**Error**: `Notarization failed` (macOS)

**Solution**:
- Verify Apple ID credentials
- Check app-specific password
- Review notarization logs in workflow

**Error**: `Version mismatch`

**Solution**: Always use `npm version` command:
```bash
npm version patch  # Updates package.json AND creates tag
```

### Workflow Issues

**Issue**: Build times out (>60 minutes)

**Solutions**:
- Check for hanging processes in logs
- Re-run the workflow
- Temporarily reduce build matrix

**Issue**: Artifacts not uploaded

**Solutions**:
- Review workflow logs
- Verify `electron-builder` completed
- Check dist-electron/ folder exists

---

## 🔙 Rollback Procedure

If issues are found after release:

### Option 1: Quick Fix (Recommended)

```bash
# Fix the bug
git commit -m "fix: critical issue"

# Release patch version
npm version patch
git push origin main --follow-tags
```

### Option 2: Remove Release

```bash
# Delete GitHub release (web UI or CLI)
gh release delete v1.0.0

# Delete git tag
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

> **Warning**: Users who downloaded will keep that version. Always prefer Option 1.

---

## 📊 Monitoring

### Post-Release Monitoring

- Track GitHub Release download statistics
- Monitor error reports (if Sentry integrated)
- Check auto-update adoption rates
- Review user feedback and bug reports

### Metrics to Track

- Download counts per platform
- Update adoption rate
- Crash reports
- User engagement

---

## 🔒 Security Considerations

- **Never** commit signing certificates to repository
- Store passwords in GitHub Secrets or secure vault
- Use CI/CD secrets for automation
- Scan packages for vulnerabilities before release
- Include security fixes in patch releases
- Follow responsible disclosure for security issues

---

## 📚 Additional Resources

### Documentation
- [Electron Builder](https://www.electron.build/)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [Auto-Update](https://www.electron.build/auto-update)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

### Tools
- [GitHub CLI](https://cli.github.com/) - `gh release` commands
- [electron-builder CLI](https://www.electron.build/cli)
- Keychain Access (macOS certificate management)

---

## 🎯 Best Practices

1. **Always test locally** before pushing tags
2. **Follow Semantic Versioning** strictly
3. **Write clear commit messages** (used for changelog)
4. **Configure code signing** for production releases
5. **Test on all platforms** before release
6. **Monitor post-release** for issues
7. **Communicate** breaking changes clearly

---

## 📞 Support

**Release workflow issues**: Check GitHub Actions logs
**Build errors**: Review this guide's troubleshooting section
**Certificate problems**: Contact team lead
**Urgent issues**: Use manual release process

---

*Last updated: January 2025*
