[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

[![Become a Sponsor](https://img.shields.io/static/v1?label=Become%20a%20Sponsor&message=%E2%9D%A4&logo=GitHub&style=flat&color=1ABC9C)](https://github.com/sponsors/datalayer)

# ⚡ Datalayer Electron Example

A native desktop application showcasing the Datalayer frontend SDK with Jupyter notebook integration.

- **Use Case**: Desktop-based data science environment with cloud compute
- **Technologies**: Electron, React, TypeScript, Datalayer SDK
- **Features**: Jupyter notebooks, runtime management, environment selection, real-time collaboration
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 6393a99 (Update repo!)
- **Status**: ✅ Production builds working! Universal binaries for all Mac processors!

This example demonstrates how to integrate the Datalayer frontend SDK into an Electron desktop application. It showcases notebook editing, runtime management, and environment selection using Datalayer's cloud infrastructure.

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/datalayer/core.git
cd core/examples/electron
npm install

# Run in development (recommended)
npm start

# Build and package for production
npm run build
npm run dist:mac           # For macOS (works on Intel & Apple Silicon)
npm run dist:win           # For Windows
npm run dist:linux         # For Linux
```

The packaged app will be in `dist-electron/` directory.

<<<<<<< HEAD
=======

This example demonstrates how to integrate the Datalayer frontend SDK into an Electron desktop application. It showcases notebook editing, runtime management, and environment selection using Datalayer's cloud infrastructure.

>>>>>>> 7c8d84d (Add electron app example (#138))
=======
>>>>>>> 6393a99 (Update repo!)
## Features

- **Jupyter Notebook Integration**: Full notebook editing capabilities with kernel management
- **Datalayer Services**: Integration with DatalayerServiceManager for cloud-based compute
- **Real-time Collaboration**: Enabled by default! Collaborative editing using DatalayerCollaborationProvider
- **Environment Management**: Browse and select from available computing environments
- **Runtime Management**: Create, start, stop, and manage cloud runtimes
- **Native Desktop Experience**: Menu bar integration, keyboard shortcuts, and native dialogs
<<<<<<< HEAD
<<<<<<< HEAD
- **Production Security**: DevTools disabled in production builds with secure context isolation
- **Development Flexibility**: DevTools enabled in dev mode, optional in dev-prod builds for testing
=======
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
- **Production Security**: DevTools disabled in production builds with secure context isolation
- **Development Flexibility**: DevTools enabled in dev mode, optional in dev-prod builds for testing
>>>>>>> 6393a99 (Update repo!)

## Prerequisites

- Node.js 18+ and npm
- Datalayer account with API credentials (optional, for cloud features)
- The main Datalayer Core library built (`npm run build:lib` in the root directory)

## Setup

1. **Install dependencies**:

   ```bash
   # From the electron example directory
   cd examples/electron
   npm install
   ```

2. **Configure environment variables** (optional, for Datalayer cloud features):

   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env and add your Datalayer credentials:
   # DATALAYER_RUN_URL=https://prod1.datalayer.run
   # DATALAYER_TOKEN=your-api-token-here
   ```

3. **Build the main library** (if not already done):
   ```bash
   # From the root directory
   cd ../..
   npm run build:lib
   ```

## Development

### Quick Start

```bash
npm start  # or npm run dev
```

This will:

- Start the Electron app with hot-reload enabled
- Open developer tools automatically
- Proxy API requests to Datalayer cloud services
- Handle CJS/ESM module resolution dynamically

<<<<<<< HEAD
<<<<<<< HEAD
> **Note**: Development mode (`npm start`) is recommended as it handles module resolution better than production builds.

### Available Scripts

```bash
npm start           # Start the app in development mode (DevTools enabled)
npm run dev         # Same as npm start
npm run build       # Build for production
=======
=======
> **Note**: Development mode (`npm start`) is recommended as it handles module resolution better than production builds.

>>>>>>> 6393a99 (Update repo!)
### Available Scripts

```bash
npm start           # Start the app in development mode (DevTools enabled)
npm run dev         # Same as npm start
<<<<<<< HEAD
npm run build       # Build for production (may have CJS/ESM issues)
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
npm run build       # Build for production
>>>>>>> 6393a99 (Update repo!)
npm run type-check  # Check TypeScript types
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
npm run format      # Format code with Prettier
npm run format:check # Check code formatting
npm run check       # Run all checks (format, lint, type-check)
npm run check:fix   # Fix all auto-fixable issues
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 6393a99 (Update repo!)

# Production builds with DevTools control
npm run dist:mac             # Production build (DevTools disabled)
npm run dist:dev-prod:mac    # Dev-prod build (DevTools enabled for testing)
npm run dist:win             # Windows production build
npm run dist:linux           # Linux production build
```

### Production Build Status ✅

**Good news!** Production builds are now working! The app successfully builds and packages for:

- ✅ **macOS Universal** - Works on Intel & Apple Silicon (M1/M2/M3)
- ✅ **macOS Intel** - x64 architecture specific builds
- ✅ **macOS ARM** - Apple Silicon specific builds
- ⏳ **Windows** - Build configuration ready, testing pending
- ⏳ **Linux** - Build configuration ready, testing pending

### Recent Fixes Applied

The following critical issues have been resolved to enable production builds:

1. **Module Export Issues** - Fixed `"default" is not exported by "@jupyterlab/services"`
2. **Vite \_\_require Wrapper** - Added handling for Vite's CommonJS wrapper in production
3. **Object Logging Errors** - Fixed `Cannot convert object to primitive value` errors
4. **Path Polyfill** - Added complete `path.posix.normalize` function implementation
5. **Universal Binary Support** - Resolved native module conflicts for universal macOS builds
6. **Native Module Handling** - Made `bufferutil` and `utf-8-validate` optional dependencies
7. **Content Security Policy (CSP) Violations** - Routed external API calls through main process
8. **Dynamic User Profile** - Fixed hardcoded GitHub user data, now fetches actual user info
9. **Runtime Termination Safety** - Added confirmation dialog to prevent accidental terminations
10. **DevTools Security** - Disabled DevTools in production builds while maintaining dev access
11. **About Dialog Security** - Fixed about dialog with secure context isolation and IPC handlers

<<<<<<< HEAD
=======
```

>>>>>>> 7c8d84d (Add electron app example (#138))
=======
>>>>>>> 6393a99 (Update repo!)
### Known Issues & Solutions

#### CJS/ESM Module Resolution

The project uses a custom Vite configuration to handle mixed CommonJS and ESM modules from the Jupyter ecosystem. Key fixes include:

- **Automatic JSX Runtime**: Uses React 17+ automatic runtime to avoid import issues
- **CommonJS Plugin**: Rollup plugin to handle mixed module formats
- **Custom Resolvers**: Handles deep imports from `@jupyterlab/services`
- **Safe Console Logging**: Prevents EPIPE errors in Electron main process
<<<<<<< HEAD
<<<<<<< HEAD
- **Path Polyfills**: Three separate polyfills with complete path API including `normalize`
- **Lodash Polyfills**: Internal data structures for production bundling
- **\_\_require Wrapper**: Detection and unwrapping for Vite's production module system

If you encounter module resolution errors, try:

1. Clean build: `rm -rf dist dist-electron node_modules/.vite`
2. Reinstall: `npm install`
3. Use dev mode: `npm start` (handles modules dynamically)
=======

If you encounter module resolution errors, use `npm start` (dev mode) which handles these dynamically.
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
- **Path Polyfills**: Three separate polyfills with complete path API including `normalize`
- **Lodash Polyfills**: Internal data structures for production bundling
- **\_\_require Wrapper**: Detection and unwrapping for Vite's production module system

If you encounter module resolution errors, try:

1. Clean build: `rm -rf dist dist-electron node_modules/.vite`
2. Reinstall: `npm install`
3. Use dev mode: `npm start` (handles modules dynamically)
>>>>>>> 6393a99 (Update repo!)

## Packaging for Distribution

### Prerequisites for Packaging

1. **Build the application first**:

   ```bash
   npm run build
   ```

2. **Platform requirements**:
   - **macOS**: Xcode Command Line Tools
   - **Windows**: Windows build tools or Wine (if building from macOS/Linux)
   - **Linux**: dpkg, rpm, or snap (depending on target format)

### Platform-Specific Packaging

#### macOS (.dmg, .app)

<<<<<<< HEAD
<<<<<<< HEAD
**Universal Binary (Recommended - Works on Intel & Apple Silicon)**

```bash
npm run dist:mac-universal
```

**Architecture-Specific Builds**

```bash
npm run dist:mac-intel     # Intel-only build (x64)
npm run dist:mac-arm       # Apple Silicon only (M1/M2/M3)
npm run dist:mac-all       # Creates both Intel and ARM builds separately
npm run dist:mac           # Uses default config (universal)
=======
```bash
npm run dist:mac
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
**Universal Binary (Recommended - Works on Intel & Apple Silicon)**

```bash
npm run dist:mac-universal
```

**Architecture-Specific Builds**

```bash
npm run dist:mac-intel     # Intel-only build (x64)
npm run dist:mac-arm       # Apple Silicon only (M1/M2/M3)
npm run dist:mac-all       # Creates both Intel and ARM builds separately
npm run dist:mac           # Uses default config (universal)
>>>>>>> 6393a99 (Update repo!)
```

Creates:

- `.dmg` - Disk image installer (recommended for distribution)
<<<<<<< HEAD
<<<<<<< HEAD
- `.zip` - Compressed app bundle
- `.app` - Application bundle (in the dmg/zip)
- Output location: `dist-electron/`

**Notes**:

- Universal binaries work on all Mac processors but are ~2x the size of single-architecture builds
- The "HFS+ is unavailable" message is informational - APFS format works on macOS 10.12+
- Native modules are handled automatically without manual rebuilding

=======
- `.app` - Application bundle
- Output location: `dist-electron/`

>>>>>>> 7c8d84d (Add electron app example (#138))
=======
- `.zip` - Compressed app bundle
- `.app` - Application bundle (in the dmg/zip)
- Output location: `dist-electron/`

**Notes**:

- Universal binaries work on all Mac processors but are ~2x the size of single-architecture builds
- The "HFS+ is unavailable" message is informational - APFS format works on macOS 10.12+
- Native modules are handled automatically without manual rebuilding

>>>>>>> 6393a99 (Update repo!)
#### Windows (.exe)

```bash
npm run dist:win
```

Creates:

- `.exe` - NSIS installer (recommended for distribution)
- Output location: `dist-electron/`

#### Linux (.AppImage)

```bash
npm run dist:linux
```

Creates:

- `.AppImage` - Universal Linux package (no installation required)
- Output location: `dist-electron/`

#### All Platforms (current platform only)

```bash
npm run dist
```

### Cross-Platform Building

**Building from macOS:**

- ✅ Can build: macOS, Linux
- ⚠️ Windows: Requires Wine (`brew install wine-stable`)

**Building from Windows:**

- ✅ Can build: Windows, Linux
- ❌ Cannot build: macOS (requires macOS hardware)

**Building from Linux:**

- ✅ Can build: Linux, Windows
- ❌ Cannot build: macOS (requires macOS hardware)

### Code Signing (Production)

For distributing outside of development:

#### macOS Code Signing

1. Get an Apple Developer Certificate
2. Set environment variables:
   ```bash
   export APPLE_ID="your-apple-id@email.com"
   export APPLE_ID_PASSWORD="your-app-specific-password"
   export APPLE_TEAM_ID="your-team-id"
   ```
3. The build process will automatically sign the app

#### Windows Code Signing

1. Get a code signing certificate
2. Configure in `package.json`:
   ```json
   "win": {
     "certificateFile": "path/to/certificate.pfx",
     "certificatePassword": "your-password"
   }
   ```

### Customizing the Build

Edit the `build` section in `package.json`:

```json
"build": {
  "appId": "io.datalayer.electron-example",
  "productName": "Datalayer Electron Example",
  "directories": {
    "output": "dist-electron"
  },
  "mac": {
    "category": "public.app-category.developer-tools"
  },
  "win": {
    "target": "nsis"  // or "portable" for no-install version
  },
  "linux": {
    "target": "AppImage"  // or "deb", "rpm", "snap"
  }
}
```

### Distribution Methods

1. **Direct Download**:

   - Upload to your website or GitHub Releases
   - Users download and install manually

2. **Auto-Updates** (add electron-updater):

   ```bash
   npm install electron-updater
   ```

   Configure auto-update server in your app

3. **App Stores**:
   - **Mac App Store**: Requires additional entitlements and sandbox configuration
   - **Microsoft Store**: Convert using Desktop Bridge
   - **Snap Store** (Linux): Build snap package

### Testing Packaged Applications

1. **Test the packaged app locally**:

   ```bash
   # macOS
   open dist-electron/*.app

   # Windows
   dist-electron\*.exe

   # Linux
   ./dist-electron/*.AppImage
   ```

2. **Verify all features work**:
   - Notebook loading and execution
   - Runtime management
   - Environment selection
   - Menu actions
   - Window management

The packaged applications will be in the `dist-electron` directory.

## Project Structure

```
examples/electron/
├── src/
│   ├── main/              # Electron main process
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 6393a99 (Update repo!)
│   │   ├── index.ts       # Main process entry, window management, EPIPE fix, DevTools control
│   │   ├── about.html     # About dialog HTML
│   │   ├── about.js       # About dialog renderer script
│   │   └── services/      # Main process services
│   │       ├── api-service.ts        # API proxy service
│   │       └── websocket-proxy.ts    # WebSocket proxy for kernels
<<<<<<< HEAD
│   ├── preload/           # Preload scripts for security
│   │   ├── index.ts       # Main context bridge for IPC
│   │   └── about.js       # About dialog secure preload script
│   └── renderer/          # React application (renderer process)
│       ├── index.html     # HTML entry point
│       ├── main.tsx       # React app bootstrap with polyfills
│       ├── App.tsx        # Main app component
│       ├── index.css      # Global styles
│       ├── components/    # React components
│       │   ├── NotebookView.tsx      # Jupyter notebook interface
│       │   ├── NotebooksList.tsx     # Notebook browser
│       │   ├── EnvironmentsList.tsx  # Environment selection
│       │   └── LoginView.tsx         # Authentication UI
│       ├── services/      # Renderer services
│       │   ├── serviceManagerLoader.ts        # Dynamic ServiceManager loader
│       │   ├── proxyServiceManager.ts         # WebSocket proxy manager
│       │   └── electronCollaborationProvider.ts # Collaboration provider
│       ├── stores/        # Zustand state management
│       │   ├── environmentStore.ts   # Environment state
│       │   └── runtimeStore.ts       # Runtime state
│       └── utils/         # Utility modules (CRITICAL FOR PRODUCTION!)
│           ├── jupyterlab-services-proxy.js   # Module export handler
│           ├── lodash-polyfills.js            # Lodash internals
│           └── path-polyfill.js               # Path module polyfill
├── electron.vite.config.ts # Vite configuration with CJS/ESM fixes
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── CLAUDE.md              # AI assistant documentation
└── README.md              # This file
=======
│   │   └── index.ts       # Main process entry, window management
=======
>>>>>>> 6393a99 (Update repo!)
│   ├── preload/           # Preload scripts for security
│   │   ├── index.ts       # Main context bridge for IPC
│   │   └── about.js       # About dialog secure preload script
│   └── renderer/          # React application (renderer process)
│       ├── index.html     # HTML entry point
│       ├── main.tsx       # React app bootstrap with polyfills
│       ├── App.tsx        # Main app component
│       ├── index.css      # Global styles
│       ├── components/    # React components
│       │   ├── NotebookView.tsx      # Jupyter notebook interface
│       │   ├── NotebooksList.tsx     # Notebook browser
│       │   ├── EnvironmentsList.tsx  # Environment selection
│       │   └── LoginView.tsx         # Authentication UI
│       ├── services/      # Renderer services
│       │   ├── serviceManagerLoader.ts        # Dynamic ServiceManager loader
│       │   ├── proxyServiceManager.ts         # WebSocket proxy manager
│       │   └── electronCollaborationProvider.ts # Collaboration provider
│       ├── stores/        # Zustand state management
│       │   ├── environmentStore.ts   # Environment state
│       │   └── runtimeStore.ts       # Runtime state
│       └── utils/         # Utility modules (CRITICAL FOR PRODUCTION!)
│           ├── jupyterlab-services-proxy.js   # Module export handler
│           ├── lodash-polyfills.js            # Lodash internals
│           └── path-polyfill.js               # Path module polyfill
├── electron.vite.config.ts # Vite configuration with CJS/ESM fixes
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
<<<<<<< HEAD
└── README.md             # This file
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
├── CLAUDE.md              # AI assistant documentation
└── README.md              # This file
>>>>>>> 6393a99 (Update repo!)
```

## Key Components

### NotebookView

Demonstrates integration with Jupyter notebooks using:

- `DatalayerServiceManager` for kernel management
- `DatalayerCollaborationProvider` for real-time collaboration (enabled by default!)
- Full notebook editing capabilities with code execution
<<<<<<< HEAD
<<<<<<< HEAD
- Runtime termination confirmation dialog for safety
=======
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
- Runtime termination confirmation dialog for safety
>>>>>>> 6393a99 (Update repo!)
- **Important**: Uses notebook UIDs (not paths) for both collaboration and kernel sessions in Datalayer SaaS

### EnvironmentsList

Shows available computing environments:

- Python, R, Julia environments
- Package listings
- Environment activation

### RuntimeManager

Manages cloud compute runtimes:

- Create new runtimes with custom configurations
- Start, stop, restart, and delete runtimes
- Monitor resource usage

## Architecture

The application follows Electron's security best practices:

1. **Context Isolation**: Renderer process is isolated from Node.js
2. **Preload Scripts**: Secure bridge between main and renderer processes
<<<<<<< HEAD
<<<<<<< HEAD
3. **Content Security Policy**: Restricts script execution, external APIs routed through main process
4. **No Node Integration**: Renderer has no direct Node.js access
5. **Secure API Calls**: All external API requests (GitHub, etc.) use Electron's `net` module in main process
6. **Production DevTools Control**: Developer tools disabled in production builds for security
7. **Keyboard Shortcut Protection**: DevTools shortcuts (F12, Ctrl+Shift+I) disabled in production
8. **Context Menu Protection**: Right-click context menu disabled in production builds
=======
3. **Content Security Policy**: Restricts script execution
4. **No Node Integration**: Renderer has no direct Node.js access
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
3. **Content Security Policy**: Restricts script execution, external APIs routed through main process
4. **No Node Integration**: Renderer has no direct Node.js access
5. **Secure API Calls**: All external API requests (GitHub, etc.) use Electron's `net` module in main process
6. **Production DevTools Control**: Developer tools disabled in production builds for security
7. **Keyboard Shortcut Protection**: DevTools shortcuts (F12, Ctrl+Shift+I) disabled in production
8. **Context Menu Protection**: Right-click context menu disabled in production builds
>>>>>>> 6393a99 (Update repo!)

## API Integration

The app integrates with Datalayer's API for:

- Runtime creation and management (`/api/runtimes/v1/runtimes`)
- Kernel lifecycle management
- Real-time collaboration via WebSocket
- Collaboration session management (`/api/spacer/v1/documents/{notebook_uid}`)
  - Note: This endpoint works for notebooks, not just documents!
  - Uses notebook UIDs from the Datalayer workspace, not file paths
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 6393a99 (Update repo!)
- User authentication (`/api/iam/v1/whoami`)
  - Fetches current user profile including GitHub integration
  - GitHub user ID extracted from `origin_s` field (format: `urn:dla:iam:ext::github:226720`)
- External API calls routed through main process to avoid CSP violations
<<<<<<< HEAD
=======
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
>>>>>>> 6393a99 (Update repo!)

## Menu Actions

The app includes native menus for:

- **File**: New, Open, Save notebook
- **Edit**: Standard editing operations
- **Kernel**: Restart, Interrupt, Shutdown
- **View**: Zoom, Developer tools, Fullscreen
- **Help**: Documentation and links

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 6393a99 (Update repo!)
## Important Implementation Details

### Critical Files for Production Builds

1. **`src/renderer/utils/jupyterlab-services-proxy.js`**

   - Handles Vite's `__require` wrapper in production
   - Manages CommonJS/ESM module exports
   - Must use namespace imports: `import * as services`

2. **`src/renderer/utils/lodash-polyfills.js`**

   - Provides internal data structures (ListCache, MapCache, Stack)
   - Required for lodash to work in production bundles
   - Loaded at the start of `main.tsx`

3. **`electron.vite.config.ts`**

   - Contains THREE path polyfills that MUST include `normalize` function
   - Custom plugins for module resolution
   - CommonJS plugin configuration

4. **`package.json`**
   - Native modules (`bufferutil`, `utf-8-validate`) are optional dependencies
   - Universal build configuration in the `mac` section
   - `npmRebuild` set to `false` to avoid build conflicts

### WebSocket Proxy for Kernels

The app uses a custom WebSocket proxy to handle kernel communication:

- Main process creates proxy server on port 8889
- Renderer connects to local proxy instead of direct Datalayer WebSocket
- Handles authentication headers and connection management

### Collaboration

Real-time collaboration is **enabled by default**:

- Uses notebook UIDs from Datalayer workspace (not file paths)
- Automatically connects when a notebook is opened
- No additional configuration required

<<<<<<< HEAD
=======
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
>>>>>>> 6393a99 (Update repo!)
## Troubleshooting

### App doesn't start

- Ensure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be 18+)
- Rebuild native modules: `npm run rebuild`
<<<<<<< HEAD
<<<<<<< HEAD
- Clean build cache: `rm -rf dist dist-electron node_modules/.vite`
=======
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
- Clean build cache: `rm -rf dist dist-electron node_modules/.vite`
>>>>>>> 6393a99 (Update repo!)

### Datalayer features not working

- Verify environment variables are set correctly
- Check network connectivity to Datalayer services
- Ensure your API token is valid
<<<<<<< HEAD
<<<<<<< HEAD
- Check browser DevTools for specific error messages

### Build failures

- Clear the build cache: `rm -rf dist dist-electron node_modules/.vite`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run type-check`
- Run format and lint: `npm run check:fix`

### Production-specific issues

- **Module not found**: Check `jupyterlab-services-proxy.js` for \_\_require handling
- **path.posix.normalize error**: Verify all three path polyfills in Vite config
- **Lodash errors**: Ensure `lodash-polyfills.js` is imported in `main.tsx`
- **Console errors**: Use `typeof` and `Object.keys()` instead of direct object logging
=======
=======
- Check browser DevTools for specific error messages
>>>>>>> 6393a99 (Update repo!)

### Build failures

- Clear the build cache: `rm -rf dist dist-electron node_modules/.vite`
- Reinstall dependencies: `rm -rf node_modules && npm install`
<<<<<<< HEAD
- Check for TypeScript errors: `npm run typecheck`
>>>>>>> 7c8d84d (Add electron app example (#138))
=======
- Check for TypeScript errors: `npm run type-check`
- Run format and lint: `npm run check:fix`

### Production-specific issues

- **Module not found**: Check `jupyterlab-services-proxy.js` for \_\_require handling
- **path.posix.normalize error**: Verify all three path polyfills in Vite config
- **Lodash errors**: Ensure `lodash-polyfills.js` is imported in `main.tsx`
- **Console errors**: Use `typeof` and `Object.keys()` instead of direct object logging
>>>>>>> 6393a99 (Update repo!)

## Resources

- [Datalayer Documentation](https://docs.datalayer.io)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Datalayer Core Repository](https://github.com/datalayer/core)

## License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](../../../../LICENSE) file for details.

## Support

- **Documentation**: [Datalayer Platform Documentation](https://docs.datalayer.app/)
- **Issues**: [GitHub Issues](https://github.com/datalayer/core/issues)
- **Community**: [Datalayer Platform](https://datalayer.app/)

---

<p align="center">
  <strong>🚀 AI Platform for Data Analysis</strong><br></br>
  <a href="https://datalayer.app/">Get started with Datalayer today!</a>
</p>
