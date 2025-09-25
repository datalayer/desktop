# Release & Distribution Guide

This guide covers building, packaging, and distributing the Datalayer Desktop application.

## Release Process Overview

1. **Prepare** - Update version, changelog
2. **Build** - Create production builds
3. **Package** - Generate platform installers
4. **Test** - Verify packages work
5. **Sign** - Code sign for distribution
6. **Publish** - Upload to GitHub Releases
7. **Announce** - Update documentation

## Version Management

### Semantic Versioning

We follow [SemVer](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features
- **Patch** (0.0.1): Bug fixes

### Updating Version

```bash
# Update version in package.json
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.1 -> 1.1.0
npm version major  # 1.1.0 -> 2.0.0
```

## Building for Production

### Prerequisites

- Node.js 22+ installed
- All dependencies installed (`npm install`)
- Clean working directory

### Build Command

```bash
# Clean previous builds
rm -rf dist dist-electron node_modules/.vite

# Install fresh dependencies
npm ci

# Build application
npm run build
```

## Platform-Specific Packaging

### macOS

#### Universal Binary (Recommended)
Works on both Intel and Apple Silicon:

```bash
npm run dist:mac-universal
```

#### Architecture-Specific
```bash
npm run dist:mac-intel   # Intel only
npm run dist:mac-arm     # Apple Silicon only
```

#### Output Files
- `.dmg` - Disk image installer
- `.zip` - Compressed app bundle
- Location: `dist-electron/`

### Windows

```bash
npm run dist:win
```

#### Output Files
- `.exe` - NSIS installer
- Location: `dist-electron/`

### Linux

```bash
npm run dist:linux
```

#### Output Files
- `.AppImage` - Universal package
- `.deb` - Debian/Ubuntu package (optional)
- `.rpm` - RedHat/Fedora package (optional)
- Location: `dist-electron/`

## Code Signing

### macOS Code Signing

#### Setup
1. Get Apple Developer Certificate
2. Install in Keychain
3. Set environment variables:

```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"
```

#### Automatic Signing
The build process automatically signs when certificates are available.

#### Manual Verification
```bash
codesign --verify --verbose dist-electron/*.app
```

### Windows Code Signing

#### Setup
1. Obtain code signing certificate (.pfx)
2. Configure in package.json:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "password"
    }
  }
}
```

#### Alternative: Environment Variables
```bash
export CSC_LINK="path/to/cert.pfx"
export CSC_KEY_PASSWORD="password"
```

## Build Configuration

### package.json Build Config

```json
{
  "build": {
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
    }
  }
}
```

## Auto-Updates

### Setting Up Auto-Updates

1. Install electron-updater:
```bash
npm install electron-updater
```

2. Configure update server in main process:
```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();
```

3. Configure publish settings:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "datalayer",
      "repo": "desktop"
    }
  }
}
```

## Testing Packages

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
```

### Testing Checklist

- [ ] App launches without errors
- [ ] Can authenticate successfully
- [ ] Notebooks load and execute
- [ ] Menus work correctly
- [ ] Window controls function
- [ ] Auto-update checks work
- [ ] Uninstall removes all files

## Publishing Releases

### GitHub Releases

1. **Create Release Tag**
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. **Create GitHub Release**
- Go to GitHub Releases page
- Click "Create a new release"
- Select the tag
- Add release notes
- Upload built packages

3. **Automated via GitHub Actions**
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm ci
      - run: npm run build
      - run: npm run dist

      - uses: softprops/action-gh-release@v1
        with:
          files: dist-electron/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Release Notes Template

```markdown
# Version X.Y.Z

## ✨ Features
- Feature 1 description
- Feature 2 description

## 🐛 Bug Fixes
- Fix 1 description
- Fix 2 description

## 🔧 Improvements
- Improvement 1
- Improvement 2

## 📦 Dependencies
- Updated package@version

## 💔 Breaking Changes
- Change description (if any)

## 📥 Downloads
- [macOS Universal](link)
- [Windows](link)
- [Linux](link)
```

## Distribution Channels

### Direct Download
- GitHub Releases (primary)
- Website downloads page

### Package Managers

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

### App Stores

#### Mac App Store
- Requires additional sandboxing
- Separate build configuration
- Apple review process

#### Microsoft Store
- Use Desktop Bridge converter
- Windows Store submission

## Monitoring

### Error Tracking
- Sentry integration for crash reports
- Analytics for usage patterns

### Update Metrics
- Track update adoption rates
- Monitor download statistics

## Rollback Procedure

If issues are found:

1. **Remove Release**
   - Mark as pre-release on GitHub
   - Add warning to release notes

2. **Notify Users**
   - Post in Discord
   - Update website

3. **Fix & Re-release**
   - Create patch version
   - Expedite testing
   - Release with fix notes

## Security Considerations

- **Never** commit signing certificates
- Store passwords in secure vault
- Use CI/CD secrets for automation
- Scan packages for vulnerabilities
- Include security fixes in patch releases

## Support

For release-related questions:
- Internal: Team Slack channel
- External: GitHub Discussions