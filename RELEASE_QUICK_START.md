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

See [RELEASE.md](./RELEASE.md) for:
- Manual build instructions
- Code signing (optional, advanced)
- Troubleshooting
- Build configuration
- Distribution channels

---

**Simple, fast, no setup required!** 🎉
