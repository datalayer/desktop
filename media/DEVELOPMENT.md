# Development Guide

Comprehensive guide for developers working on the Datalayer Desktop Electron application.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Application Startup Flow](#application-startup-flow)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Development Workflow](#development-workflow)
- [Build System](#build-system)
- [Security Architecture](#security-architecture)
- [State Management](#state-management)
- [Common Development Tasks](#common-development-tasks)
- [Debugging Guide](#debugging-guide)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- **Node.js**: 22+ (Node.js 22 LTS recommended)
- **npm**: Included with Node.js
- **Git**: For version control
- **Platform-specific build tools**:
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: Windows Build Tools
  - Linux: build-essential (`sudo apt-get install build-essential`)

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/datalayer/desktop.git
cd desktop

# 2. Install dependencies
npm install

# 3. (Optional) Configure environment for cloud features
cp .env.example .env
# Edit .env with your credentials:
# DATALAYER_RUN_URL=https://prod1.datalayer.run
# DATALAYER_TOKEN=your-api-token-here

# 4. Start development server
npm start
```

The app will launch with hot-reload enabled, DevTools open, and source maps for debugging.

### Essential Commands

```bash
# Development
npm start                # Start in dev mode (recommended)
npm run dev             # Same as npm start

# Code Quality
npm run check           # Run all checks (format, lint, type-check)
npm run check:fix       # Auto-fix all issues
npm run lint            # ESLint only
npm run format          # Format with Prettier
npm run type-check      # TypeScript checking

# Building
npm run build                 # Build for production
npm run dist:mac-universal    # Package for macOS (universal - Intel & Apple Silicon)
npm run dist:win              # Package for Windows
npm run dist:linux            # Package for Linux

# Documentation
npm run docs            # Generate TypeDoc documentation
npm run docs:watch      # Watch mode for docs
```

---

## Architecture Overview

### Electron Multi-Process Architecture

Datalayer Desktop follows Electron's security best practices with **strict process separation**:

```
┌──────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                           │
│                    (Node.js Environment)                       │
│                                                               │
│  Entry Point: src/main/index.ts                              │
│  ├── Application lifecycle (window creation, menus)          │
│  ├── IPC handlers (authentication, runtimes, notebooks)      │
│  ├── SDK Bridge (DatalayerClient wrapper)                    │
│  ├── WebSocket Proxy (kernel communication)                  │
│  └── Security (CSP, context isolation)                       │
│                                                               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ IPC Communication
                         │ (via contextBridge)
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                     PRELOAD SCRIPT                            │
│                (Secure Bridge - No Node.js)                   │
│                                                               │
│  Entry Point: src/preload/index.ts                           │
│  ├── contextBridge.exposeInMainWorld()                       │
│  ├── electronAPI (system info, menu actions)                 │
│  ├── proxyAPI (HTTP/WebSocket for kernels)                   │
│  └── datalayerClient (auth, runtimes, notebooks)             │
│                                                               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Exposed APIs
                         │ (window.electronAPI, etc.)
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    RENDERER PROCESS                           │
│                  (Chromium + React + Vite)                    │
│                                                               │
│  Entry Points:                                                │
│  1. index.html (HTML shell)                                   │
│  2. src/renderer/main.tsx (polyfills + React)                │
│  3. src/renderer/App.tsx (main React component)              │
│                                                               │
│  ├── React Application (UI components, pages)                │
│  ├── Zustand Stores (state management)                       │
│  ├── Jupyter Integration (@jupyterlab/services)              │
│  ├── Lexical Editor (document editing)                       │
│  └── Custom Hooks (runtime management, collaboration)        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

1. **Security**: Renderer has NO direct Node.js access (context isolation enabled)
2. **Stability**: Main process crash won't affect renderer, and vice versa
3. **CSP Compliance**: All external APIs proxied through main process
4. **Type Safety**: TypeScript contracts at all IPC boundaries

---

## Application Startup Flow

Understanding the complete startup sequence is crucial for debugging and extending the app.

### 1. Main Process Initialization

**Entry Point**: [`src/main/index.ts`](src/main/index.ts:1)

```typescript
// Startup sequence in src/main/index.ts

// STEP 1: Initialize logging FIRST (before any other imports)
import { initializeLogging, setupConsoleOverrides } from './config/logging';
initializeLogging();
setupConsoleOverrides();

// STEP 2: Import core Electron modules
import { app, ipcMain, shell } from 'electron';
import { Application } from './app/application';
import { sdkBridge } from './services/datalayer-sdk-bridge';
import { websocketProxy } from './services/websocket-proxy';

// STEP 3: Main function - orchestrates startup
async function main(): Promise<void> {
  // 3a. Wait for app to be ready
  await app.whenReady();

  // 3b. Initialize SDK bridge (must be AFTER app ready)
  await sdkBridge.initialize();

  // 3c. Register all IPC handlers
  registerIPCHandlers();

  // 3d. Set up application event handlers
  Application.setupEventHandlers();

  // 3e. Initialize application (creates window, menu)
  await Application.initialize();

  // 3f. Restore stored authentication if available
  const authState = sdkBridge.getAuthState();
  if (authState.isAuthenticated) {
    // Broadcast to renderer after delay (wait for renderer to be ready)
    setTimeout(() => {
      mainWindow.webContents.send('auth-state-changed', authState);
    }, 2000);
  }
}

// STEP 4: Start the application
main();
```

**Key Files**:
- [`src/main/app/application.ts`](src/main/app/application.ts:1) - Window and menu creation
- [`src/main/app/window-manager.ts`](src/main/app/window-manager.ts) - BrowserWindow configuration
- [`src/main/app/menu-manager.ts`](src/main/app/menu-manager.ts) - Application menu
- [`src/main/services/datalayer-sdk-bridge.ts`](src/main/services/datalayer-sdk-bridge.ts:1) - SDK wrapper
- [`src/main/services/websocket-proxy.ts`](src/main/services/websocket-proxy.ts:1) - Kernel communication

### 2. Preload Script Execution

**Entry Point**: [`src/preload/index.ts`](src/preload/index.ts:1)

```typescript
// Executed BEFORE renderer loads any code

import { contextBridge, ipcRenderer } from 'electron';

// Expose three secure APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  onMenuAction: (callback) => { /* ... */ },
  notifyRuntimeTerminated: (runtimeId) => { /* ... */ },
  // ... more methods
});

contextBridge.exposeInMainWorld('proxyAPI', {
  httpRequest: (options) => ipcRenderer.invoke('proxy:http-request', options),
  websocketOpen: (config) => ipcRenderer.invoke('proxy:websocket-open', config),
  // ... more proxy methods
});

contextBridge.exposeInMainWorld('datalayerClient', {
  login: (token) => ipcRenderer.invoke('datalayer:login', { token }),
  logout: () => ipcRenderer.invoke('datalayer:logout'),
  listEnvironments: () => ipcRenderer.invoke('datalayer:list-environments'),
  // ... all SDK methods
});
```

**Result**: Renderer can safely call `window.electronAPI.*`, `window.proxyAPI.*`, `window.datalayerClient.*`

### 3. Renderer Process Initialization

**Entry Points (in order)**:

#### 3a. HTML Shell

**File**: `index.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Datalayer Desktop</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- Vite injects script tag for main.tsx -->
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

#### 3b. Polyfills and React Bootstrap

**File**: [`src/renderer/main.tsx`](src/renderer/main.tsx:1)

```typescript
// STEP 1: Load ALL polyfills first (critical order!)
import './polyfills';  // Symbol, lodash, Node.js APIs, RequireJS, JupyterLab

// STEP 2: Configure Prism.js for syntax highlighting
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
(window as any).Prism = Prism;

// STEP 3: Import and render React app
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// STEP 4: Mount React to DOM
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Polyfill Loading Order** (handled by [`src/renderer/polyfills/index.ts`](src/renderer/polyfills/index.ts)):

1. **Symbol polyfill** - React requires `Symbol.for`
2. **Lodash numbered variations** - For bundled code (`baseGetTag$1`, `Map$2`, etc.)
3. **Lodash internals** - Data structures (ListCache, MapCache, Stack)
4. **Lodash globals** - Make `_` and `Backbone` globally available
5. **RequireJS shim** - AMD module compatibility for Jupyter widgets
6. **JupyterLab services proxy** - Handle Vite's `__require` wrapper in production

#### 3c. Main React Application

**File**: [`src/renderer/App.tsx`](src/renderer/App.tsx:1)

```typescript
// Main app component - handles authentication and routing

const App: React.FC = () => {
  // STEP 1: Set up console filtering (reduce noise)
  useEffect(() => {
    const cleanup = setupConsoleFiltering();
    return cleanup;
  }, []);

  // STEP 2: Initialize state
  const [currentView, setCurrentView] = useState<ViewType>('environments');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // STEP 3: Parallel initialization (auth check + component preloading)
  useEffect(() => {
    const initializeApp = async () => {
      // Start preloading components immediately
      const preloadPromise = startAllPreloads();

      // Get initial auth state from main process
      const authPromise = window.datalayerClient?.getAuthState();

      // Wait for both to complete
      await Promise.allSettled([authPromise, preloadPromise]);
      setComponentsPreloaded(true);
      setIsCheckingAuth(false);
    };

    initializeApp();
  }, []);

  // STEP 4: Listen for auth state changes from main process
  useEffect(() => {
    if (window.electronAPI?.onAuthStateChanged) {
      window.electronAPI.onAuthStateChanged((newAuthState) => {
        setAuthState(newAuthState);
        setIsAuthenticated(newAuthState.isAuthenticated);
      });
    }
  }, []);

  // STEP 5: Render login or main app based on auth state
  return (
    <>
      {/* Login view */}
      <Box sx={{ display: showLogin ? 'block' : 'none' }}>
        <Login onUserDataFetched={handleUserDataFetched} />
      </Box>

      {/* Main app view */}
      <Box sx={{ display: showMainApp ? 'flex' : 'none' }}>
        <AppLayout>
          <AppHeader {...headerProps} />
          <Box>{renderView()}</Box>
        </AppLayout>
      </Box>
    </>
  );
};
```

**Component Lazy Loading**:

```typescript
// Heavy components are lazy loaded for faster startup
const NotebookEditor = lazy(() => import('./pages/NotebookEditor'));
const DocumentEditor = lazy(() => import('./pages/DocumentEditor'));
const Library = lazy(() => import('./pages/Spaces'));
const Runtimes = lazy(() => import('./pages/Runtimes'));
```

### Complete Startup Timeline

```
Time  | Process   | Action
------+-----------+---------------------------------------------------
0ms   | Main      | Logging initialized
10ms  | Main      | Electron app ready
15ms  | Main      | SDK bridge initialized, token restored (if exists)
20ms  | Main      | IPC handlers registered
25ms  | Main      | Application event handlers set up
30ms  | Main      | Window created, preload script executed
35ms  | Preload   | contextBridge APIs exposed to renderer
40ms  | Renderer  | index.html loaded
45ms  | Renderer  | main.tsx starts, polyfills loaded
50ms  | Renderer  | Prism.js configured
55ms  | Renderer  | React app rendered
60ms  | Renderer  | App.tsx starts, console filtering applied
65ms  | Renderer  | Parallel: auth check + component preloading
500ms | Renderer  | Components preloaded, auth state received
600ms | Renderer  | Show login OR main app based on auth
2000ms| Main      | Broadcast stored auth state to renderer (if exists)
```

---

## Directory Structure

```
desktop/
├── src/
│   ├── main/                      # Main process (Node.js)
│   │   ├── index.ts              # 🎯 MAIN ENTRY POINT
│   │   ├── app/                  # Application management
│   │   │   ├── application.ts    # Lifecycle management
│   │   │   ├── window-manager.ts # Window creation/config
│   │   │   ├── menu-manager.ts   # Application menu
│   │   │   ├── security-manager.ts # Security policies
│   │   │   └── environment.ts    # Environment detection
│   │   ├── config/               # Configuration
│   │   │   ├── constants.ts      # App constants
│   │   │   └── logging.ts        # Logging setup
│   │   ├── dialogs/              # Native dialogs
│   │   │   └── about/            # About dialog
│   │   └── services/             # Backend services
│   │       ├── datalayer-sdk-bridge.ts  # SDK wrapper
│   │       └── websocket-proxy.ts       # WebSocket proxy
│   │
│   ├── preload/                   # Preload scripts (Secure bridge)
│   │   ├── index.ts              # 🎯 PRELOAD ENTRY POINT
│   │   └── about.js              # About dialog preload
│   │
│   ├── renderer/                  # Renderer process (React)
│   │   ├── main.tsx              # 🎯 RENDERER ENTRY POINT
│   │   ├── App.tsx               # 🎯 MAIN REACT COMPONENT
│   │   ├── components/           # UI components (domain-driven)
│   │   │   ├── common/           # Shared, reusable components
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   └── ErrorMessage.tsx
│   │   │   ├── app/              # App shell components
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── UserMenu.tsx
│   │   │   │   ├── Layout.tsx
│   │   │   │   ├── LoadingScreen.tsx
│   │   │   │   ├── NavigationTab.tsx
│   │   │   │   └── NavigationTabs.tsx
│   │   │   ├── auth/             # Authentication components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── ErrorMessage.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Form.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Version.tsx
│   │   │   ├── runtime/          # Runtime management components
│   │   │   │   ├── CreateRuntimeDialog.tsx
│   │   │   │   ├── RuntimeSelector.tsx
│   │   │   │   ├── RuntimeProgressBar.tsx
│   │   │   │   └── TerminateRuntimeDialog.tsx
│   │   │   ├── environments/     # Environment selection
│   │   │   │   ├── AuthWarning.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   └── ErrorState.tsx
│   │   │   ├── spaces/           # Space/library management
│   │   │   │   ├── CreateDocumentDialog.tsx
│   │   │   │   ├── DeleteConfirmationDialog.tsx
│   │   │   │   ├── EditItemDialog.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── SpaceItem.tsx
│   │   │   │   └── SpaceSection.tsx
│   │   │   ├── notebook/         # Notebook editor components
│   │   │   │   ├── Content.tsx
│   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── KernelSelectionDialog.tsx
│   │   │   │   └── Toolbar.tsx
│   │   │   └── document/         # Lexical document components
│   │   │       ├── EditorInitPlugin.tsx
│   │   │       ├── Header.tsx
│   │   │       └── LexicalEditor.tsx
│   │   ├── pages/                # Main views
│   │   │   ├── Login.tsx         # Login page
│   │   │   ├── Environments.tsx  # Environment selection
│   │   │   ├── Runtimes.tsx      # Runtime management dashboard
│   │   │   ├── Spaces.tsx        # Library/spaces browser
│   │   │   ├── NotebookEditor.tsx  # Notebook editor
│   │   │   └── DocumentEditor.tsx  # Lexical document editor
│   │   ├── services/             # Frontend services
│   │   │   ├── proxyServiceManager.ts    # Jupyter proxy
│   │   │   ├── serviceManagerLoader.ts   # Dynamic loader
│   │   │   └── collaborationWebSocketAdapter.ts
│   │   ├── stores/               # Zustand state management
│   │   │   ├── runtimeStore.ts   # Runtime lifecycle
│   │   │   └── environmentStore.ts # Environments
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── usePreload.ts     # Component preloading
│   │   │   ├── useRuntimeManagement.ts
│   │   │   └── useCollaboration.ts
│   │   ├── utils/                # Utilities
│   │   │   ├── logger.ts         # Logging
│   │   │   ├── app.ts            # App utilities
│   │   │   ├── notebook.ts       # Notebook utilities
│   │   │   └── document.ts       # Document utilities
│   │   ├── polyfills/            # Browser/Node.js polyfills
│   │   │   ├── index.ts          # 🎯 Polyfill entry (critical!)
│   │   │   ├── symbol.ts         # Symbol polyfill
│   │   │   ├── lodash-numbered.ts
│   │   │   ├── lodash-internals.ts
│   │   │   ├── lodash-globals.ts
│   │   │   ├── node-builtins.ts  # path, fs, etc.
│   │   │   ├── requirejs.ts      # RequireJS shim
│   │   │   └── jupyterlab-proxy.ts
│   │   └── theme/                # UI theme
│   │       └── datalayerTheme.ts
│   │
│   └── shared/                    # Shared types/constants
│       ├── types/                 # TypeScript interfaces
│       │   ├── index.ts
│       │   ├── app.types.ts
│       │   ├── environments.types.ts
│       │   ├── notebook.types.ts
│       │   ├── document.types.ts
│       │   └── documents.types.ts
│       └── constants/             # Shared constants
│           └── colors.ts
│
├── resources/                     # Static resources
│   └── icon.png                  # App icon
│
├── electron.vite.config.ts       # 🎯 BUILD CONFIGURATION
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript config
├── typedoc.json                  # Documentation config
├── .env.example                  # Environment template
└── README.md                     # User documentation
```

---

## Core Components

### Main Process Components

#### 1. SDK Bridge ([`datalayer-sdk-bridge.ts`](src/main/services/datalayer-sdk-bridge.ts:1))

**Purpose**: Wraps `@datalayer/core` SDK for use in Electron with secure token storage.

**Key Features**:
- Automatic snake_case → camelCase method conversion
- Secure token storage using Electron's `safeStorage`
- Model serialization for IPC (converts SDK models to JSON)
- Method logging and error handling

**Usage**:
```typescript
// In main process IPC handler
ipcMain.handle('datalayer:list-environments', async () => {
  const environments = await sdkBridge.call('list_environments');
  return environments; // Returns EnvironmentJSON[] (IPC-safe)
});
```

#### 2. WebSocket Proxy ([`websocket-proxy.ts`](src/main/services/websocket-proxy.ts:1))

**Purpose**: Proxy WebSocket connections from renderer to Jupyter kernels.

**Why Needed**: CSP policies prevent direct WebSocket connections from renderer.

**Features**:
- Connection pooling by runtime ID
- Automatic cleanup on runtime termination
- Prevents connections to terminated runtimes
- Forwards messages between renderer and kernel

**Architecture**:
```
Renderer → IPC (proxy:websocket-open) → Main Process → WebSocket → Kernel
         ← IPC (ws-message-{id})      ←               ←          ←
```

#### 3. Application Manager ([`application.ts`](src/main/app/application.ts:1))

**Purpose**: Manages application lifecycle.

**Responsibilities**:
- Window creation via `window-manager.ts`
- Menu creation via `menu-manager.ts`
- Event handler setup (window-all-closed, activate, etc.)
- Platform-specific configuration (dock icon on macOS)

### Renderer Process Components

#### 1. Runtime Store ([`runtimeStore.ts`](src/renderer/stores/runtimeStore.ts))

**Purpose**: Zustand store for runtime lifecycle management.

**State**:
```typescript
{
  runtimes: Map<notebookId, {
    runtime: RuntimeJSON,
    serviceManager: ServiceManager,
    isCreating: boolean,
    error: string | null
  }>,

  // Methods
  createRuntimeForNotebook(notebookId, envName),
  terminateRuntime(notebookId),
  getRuntime(notebookId),
}
```

**Cleanup System**:
- Global cleanup registry: `window.__datalayerRuntimeCleanup`
- Prevents new connections to terminated runtimes
- Disposes ServiceManager properly
- Notifies main process to block WebSocket connections

#### 2. Proxy Service Manager ([`proxyServiceManager.ts`](src/renderer/services/proxyServiceManager.ts))

**Purpose**: Wrapper around `@jupyterlab/services` that uses Electron IPC for HTTP/WebSocket.

**Key Features**:
- Custom `ServerConnection` that routes all requests through `window.proxyAPI`
- WebSocket connections use main process proxy
- Kernel/session management with runtime-specific credentials

**Usage**:
```typescript
const serviceManager = await createProxyServiceManager(
  runtime.runtime.ingress,  // Jupyter server URL
  runtime.runtime.token,    // Runtime-specific token
  runtime.runtime.pod_name  // Runtime ID
);

// Now use serviceManager for kernel operations
const kernel = await serviceManager.kernels.startNew();
```

#### 3. Document and Notebook Editors

**Notebook Editor** ([`NotebookEditor.tsx`](src/renderer/pages/NotebookEditor.tsx)):
- Uses `@datalayer/jupyter-react` for native Jupyter cells
- Runtime management via `runtimeStore`
- Kernel selection dialog
- Save functionality
- Multi-tab support for multiple open notebooks

**Document Editor** ([`DocumentEditor.tsx`](src/renderer/pages/DocumentEditor.tsx)):
- Lexical editor for rich text + Jupyter cells
- Real-time collaboration via Loro CRDT
- Auto-creates runtimes for documents
- Runtime readiness polling (waits for Jupyter server to be accessible)
- Multi-tab support for multiple open documents

**Runtimes Manager** ([`Runtimes.tsx`](src/renderer/pages/Runtimes.tsx)):
- Dashboard view of all active runtimes
- Create new runtimes with environment selection
- Monitor runtime status and resource usage
- Terminate runtimes with confirmation dialog
- Real-time status updates

**Spaces Library** ([`Spaces.tsx`](src/renderer/pages/Spaces.tsx)):
- Browse notebooks and documents across all Datalayer spaces
- Search and filter items
- Create new notebooks and documents
- Download items locally
- Delete items with confirmation

**Environments Page** ([`Environments.tsx`](src/renderer/pages/Environments.tsx)):
- Select runtime environment (Python, AI/ML, R, Julia, etc.)
- View environment details and capabilities
- Integration with Datalayer platform environments API

---

## Development Workflow

### Day-to-Day Development

```bash
# Start dev server (hot reload, DevTools enabled)
npm start

# In another terminal, run checks on save
npm run check:fix
```

### Making Changes

#### 1. Adding a New IPC Method

**Step 1**: Define in main process ([`src/main/index.ts`](src/main/index.ts)):

```typescript
// In registerIPCHandlers()
ipcMain.handle('datalayer:my-new-method', async (_, arg1, arg2) => {
  const result = await sdkBridge.call('my_sdk_method', arg1, arg2);
  return result; // Must be JSON-serializable
});
```

**Step 2**: Expose in preload ([`src/preload/index.ts`](src/preload/index.ts)):

```typescript
contextBridge.exposeInMainWorld('datalayerClient', {
  // ... existing methods
  myNewMethod: (arg1, arg2) =>
    ipcRenderer.invoke('datalayer:my-new-method', arg1, arg2),
});
```

**Step 3**: Use in renderer:

```typescript
const result = await window.datalayerClient.myNewMethod(arg1, arg2);
```

#### 2. Creating a New Page Component

**Step 1**: Create page file:

```typescript
// src/renderer/pages/MyNewPage.tsx
import React from 'react';
import { Box } from '@primer/react';

const MyNewPage: React.FC = () => {
  return (
    <Box p={3}>
      <h1>My New Page</h1>
    </Box>
  );
};

export default MyNewPage;
```

**Step 2**: Add to App.tsx routing:

```typescript
// In App.tsx
import MyNewPage from './pages/MyNewPage';

// Add to state
const [currentView, setCurrentView] = useState<ViewType>('environments');

// Add to renderView()
const renderView = () => {
  // ... existing views
  <Box sx={{ display: currentView === 'mypage' ? 'block' : 'none' }}>
    <MyNewPage />
  </Box>
};
```

**Step 3**: Add navigation (in `AppHeader.tsx` or menu):

```typescript
<NavigationTab
  label="My Page"
  icon={MyIcon}
  isActive={currentView === 'mypage'}
  onClick={() => onViewChange('mypage')}
/>
```

#### 3. Adding a New Store

```typescript
// src/renderer/stores/myStore.ts
import { create } from 'zustand';

interface MyState {
  data: any[];
  loading: boolean;
  fetchData: () => Promise<void>;
}

export const useMyStore = create<MyState>((set) => ({
  data: [],
  loading: false,

  fetchData: async () => {
    set({ loading: true });
    try {
      const data = await window.datalayerClient.getData();
      set({ data, loading: false });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      set({ loading: false });
    }
  },
}));
```

**Usage in component**:

```typescript
import { useMyStore } from '../stores/myStore';

const MyComponent = () => {
  const { data, loading, fetchData } = useMyStore();

  useEffect(() => {
    fetchData();
  }, []);

  return <div>{loading ? 'Loading...' : data.length}</div>;
};
```

### Code Quality Workflow

```bash
# Before committing
npm run check:fix     # Auto-fix formatting, linting, check types

# Individual checks
npm run format        # Prettier
npm run lint:fix      # ESLint
npm run type-check    # TypeScript
```

---

## Build System

### Recent Improvements (January 2025)

#### Memory Optimization
Increased Node.js heap size from 4GB to 8GB to handle large dependency graphs during renderer build:
```json
{
  "scripts": {
    "build": "... NODE_OPTIONS=--max-old-space-size=8192 ..."
  }
}
```

#### Backbone Conflict Resolution
Fixed duplicate `Backbone` identifier errors in @jupyter-widgets/base by renaming imports:
```typescript
// In electron.vite.config.ts - Custom Vite plugin
{
  name: 'fix-jupyter-widgets-backbone',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('@jupyter-widgets/base')) {
      // Rename Backbone → BackboneLib to avoid conflicts
      let fixed = code.replace(
        /import \* as Backbone from ['"]backbone['"]/g,
        "import * as BackboneLib from 'backbone'"
      );
      fixed = fixed.replace(/\bBackbone\b(?!Lib)/g, 'BackboneLib');
      return fixed;
    }
  }
}
```

#### Dynamic Import Fix
ServiceManager now uses dynamic imports to work around Rollup CommonJS export issues:
```typescript
// src/renderer/services/serviceManagerLoader.ts
export async function loadServiceManager() {
  const services = await import('@jupyterlab/services');
  return {
    ServiceManager: services.ServiceManager,
    ServerConnection: services.ServerConnection,
  };
}
```

### Vite Configuration ([`electron.vite.config.ts`](electron.vite.config.ts))

The build system has **three separate configurations**:

#### 1. Main Process Build

```typescript
main: {
  plugins: [externalizeDepsPlugin(), copyStaticFilesPlugin()],
  resolve: {
    alias: { '@datalayer/core': resolve(__dirname, '../core') },
  },
  build: {
    outDir: 'dist/main',
    rollupOptions: {
      input: { index: resolve(__dirname, 'src/main/index.ts') },
    },
  },
}
```

**Output**: `dist/main/index.js` (Node.js code)

#### 2. Preload Script Build

```typescript
preload: {
  plugins: [externalizeDepsPlugin()],
  build: {
    outDir: 'dist/preload',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/preload/index.ts'),
        about: resolve(__dirname, 'src/preload/about.js'),
      },
    },
  },
}
```

**Output**: `dist/preload/index.js`, `dist/preload/about.js`

#### 3. Renderer Build (Most Complex)

```typescript
renderer: {
  root: 'src/renderer',
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    commonjs({ transformMixedEsModules: true }),
    wasm(), topLevelAwait(),
    // ... custom plugins for polyfills
  ],
  build: {
    outDir: '../../dist/renderer',
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/index.html'),
    },
  },
}
```

**Output**: `dist/renderer/index.html`, `dist/renderer/assets/*.js`, `dist/renderer/assets/*.css`

### Production Build Process

```bash
npm run build
```

**Steps**:
1. TypeScript type checking (`tsc --noEmit`)
2. Vite builds all three targets (main, preload, renderer)
3. Post-build script (`scripts/fix-production-bundle.js`) runs:
   - Injects critical polyfills at bundle start
   - Fixes CommonJS/ESM interop issues
   - Adds Symbol polyfill for React

```bash
npm run dist:mac-universal  # or dist:win, dist:linux
```

**Steps**:
1. Runs `npm run build`
2. electron-builder packages the app:
   - Creates `.app` bundle (macOS) or `.exe` (Windows) or `.AppImage` (Linux)
   - Signs code (if configured)
   - Creates installer/DMG

**Output**: `dist-electron/` directory with packaged app

### Development vs Production Differences

| Feature | Development | Production |
|---------|------------|------------|
| **Entry** | Vite dev server | Built files |
| **DevTools** | Enabled by default | Disabled |
| **Source Maps** | Full source maps | No source maps |
| **Hot Reload** | Enabled | N/A |
| **Module Resolution** | Dynamic (Vite) | Static (bundled) |
| **Polyfills** | Loaded from source | Injected in bundle |
| **CSP** | Relaxed | Strict |

---

## Security Architecture

### Context Isolation

**Enabled in** [`window-manager.ts`](src/main/app/window-manager.ts):

```typescript
webPreferences: {
  contextIsolation: true,  // Renderer CANNOT access Node.js
  nodeIntegration: false,  // No require() in renderer
  sandbox: false,          // Needed for preload script
  preload: join(__dirname, '../preload/index.js'),
}
```

**Result**: Renderer can ONLY access APIs exposed via `contextBridge`.

### Content Security Policy (CSP)

**Applied in production**:

```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "connect-src 'self' https://prod1.datalayer.run wss://*; " +
        // ...
      ]
    }
  });
});
```

**Why**: Prevents XSS attacks, limits external connections.

### IPC Validation

All IPC handlers validate inputs:

```typescript
ipcMain.handle('datalayer:create-runtime', async (_, options) => {
  // Validation (implicit in TypeScript types)
  const runtime = await sdkBridge.call(
    'createRuntime',
    options.environmentName,
    options.type,
    options.givenName,
    options.minutesLimit
  );
  return runtime;
});
```

**Best Practice**: Always validate IPC arguments, never trust renderer input.

### Token Storage

Uses Electron's `safeStorage` API (platform-specific encryption):

```typescript
// In datalayer-sdk-bridge.ts
private storeToken(token: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token);
    writeFileSync(this.tokenPath, encrypted);
  }
}

private loadStoredToken(): string | null {
  if (existsSync(this.tokenPath)) {
    const encrypted = readFileSync(this.tokenPath);
    return safeStorage.decryptString(encrypted);
  }
  return null;
}
```

**Security**: Token is encrypted at rest using OS-level encryption (Keychain on macOS, DPAPI on Windows, libsecret on Linux).

---

## State Management

### Zustand Stores

#### Runtime Store Pattern

```typescript
// src/renderer/stores/runtimeStore.ts
import { create } from 'zustand';

interface RuntimeState {
  runtimes: Map<string, RuntimeInfo>;

  // Async actions
  createRuntimeForNotebook: (notebookId, envName) => Promise<void>;
  terminateRuntime: (notebookId) => Promise<void>;

  // Sync getters
  getRuntime: (notebookId) => RuntimeInfo | undefined;
}

export const useRuntimeStore = create<RuntimeState>((set, get) => ({
  runtimes: new Map(),

  createRuntimeForNotebook: async (notebookId, envName) => {
    // Set loading state
    set(state => ({
      runtimes: new Map(state.runtimes).set(notebookId, {
        ...state.runtimes.get(notebookId),
        isCreating: true
      })
    }));

    // Call IPC
    const runtime = await window.datalayerClient.createRuntime({
      environmentName: envName,
      type: 'notebook',
      givenName: notebookId,
    });

    // Create ServiceManager
    const serviceManager = await createProxyServiceManager(
      runtime.runtime.ingress,
      runtime.runtime.token,
      runtime.runtime.pod_name
    );

    // Update state
    set(state => ({
      runtimes: new Map(state.runtimes).set(notebookId, {
        runtime,
        serviceManager,
        isCreating: false,
        error: null
      })
    }));
  },

  // ... other methods
}));
```

**Usage in components**:

```typescript
const MyComponent = () => {
  const { runtimes, createRuntimeForNotebook } = useRuntimeStore();

  const runtime = runtimes.get(notebookId);

  if (!runtime) {
    return <Button onClick={() => createRuntimeForNotebook(notebookId, 'python')}>
      Create Runtime
    </Button>;
  }

  return <div>Runtime: {runtime.runtime.pod_name}</div>;
};
```

### Global State (Outside Zustand)

Some state is managed globally for cross-process communication:

```typescript
// Cleanup registry (in both main and renderer)
(global as any).__datalayerRuntimeCleanup = new Map<string, { terminated: boolean }>();

// Lodash and Backbone (for Jupyter widgets)
(window as any)._ = lodash;
(window as any).Backbone = Backbone;
```

---

## Common Development Tasks

### Adding a New Environment

**Backend**: Environments come from the Datalayer API (no code changes needed).

**Frontend**: The `Environments` page automatically displays all environments from the API.

### Adding a New Jupyter Widget

Jupyter widgets require global `_` (lodash) and `Backbone`:

```typescript
// Already set up in src/renderer/polyfills/lodash-globals.ts
window._ = lodash;
window.Backbone = Backbone;

// Widgets will work automatically
```

### Customizing the Application Menu

Edit [`src/main/app/menu-manager.ts`](src/main/app/menu-manager.ts):

```typescript
const template: MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New Notebook',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          mainWindow?.webContents.send('menu-action', 'new-notebook');
        }
      },
      // ... more items
    ]
  },
  // ... more menus
];
```

**Handle in renderer** ([`App.tsx`](src/renderer/App.tsx)):

```typescript
useEffect(() => {
  if (window.electronAPI) {
    window.electronAPI.onMenuAction((action: string) => {
      switch (action) {
        case 'new-notebook':
          // Handle new notebook
          break;
        // ... other actions
      }
    });
  }
}, []);
```

### Debugging IPC Communication

**Enable IPC logging**:

```typescript
// In src/main/services/datalayer-sdk-bridge.ts
handlers: {
  beforeCall: (method, args) => {
    log.debug(`[SDK] → ${method}`, { argsCount: args.length });
  },
  afterCall: method => {
    log.debug(`[SDK] ✓ ${method} completed`);
  },
  onError: (method, error) => {
    log.error(`[SDK] ✗ ${method} failed:`, error);
  },
}
```

**View logs**:
- macOS: `~/Library/Logs/Datalayer Desktop/main.log`
- Windows: `%USERPROFILE%\AppData\Roaming\Datalayer Desktop\logs\main.log`
- Linux: `~/.config/Datalayer Desktop/logs/main.log`

---

## Debugging Guide

### Development Mode Debugging

#### 1. Renderer Process (React/UI)

**DevTools are automatically open** in development mode.

**Console access**:
- All `console.log()`, `console.error()`, etc. appear in DevTools
- React DevTools extension works
- Network tab shows all HTTP requests

**Breakpoints**:
- Set breakpoints in DevTools Sources tab
- Source maps are enabled, so you see TypeScript source

**React debugging**:
```bash
# Install React DevTools extension in Chrome
# It will automatically work in Electron DevTools
```

#### 2. Main Process (Node.js)

**Logging**:

```typescript
import log from 'electron-log/main';

log.info('Info message');
log.error('Error message');
log.debug('Debug message');
```

**Attach debugger**:

```bash
# Start with Node.js inspector
npm start -- --inspect=5858

# In Chrome/Edge, go to:
chrome://inspect
# Click "Inspect" next to the Electron process
```

**VSCode debugging**:

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceRoot}",
      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron-vite",
      "runtimeArgs": ["--sourcemap"],
      "outFiles": ["${workspaceRoot}/dist/**/*.js"]
    }
  ]
}
```

#### 3. Preload Script

Preload debugging is tricky:

```typescript
// Use console.log - it appears in renderer DevTools
console.log('[Preload] Exposing APIs...');

// Or log to main process
import { ipcRenderer } from 'electron';
ipcRenderer.send('preload-log', 'Message from preload');
```

### Production Build Debugging

**Enable DevTools in production** (for testing only):

```bash
npm run dist:dev-prod:mac
```

This builds a production-like app with DevTools enabled.

### Common Issues and Fixes

#### Issue: "Module not found" in development

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
npm start
```

#### Issue: "ServiceManager is undefined"

**Cause**: Module resolution issue in production build.

**Fix**: Check [`jupyterlab-proxy.ts`](src/renderer/polyfills/jupyterlab-proxy.ts) is loaded.

#### Issue: "Symbol.for is not a function"

**Cause**: Polyfills not loaded in correct order.

**Fix**: Verify [`polyfills/index.ts`](src/renderer/polyfills/index.ts) loads Symbol first.

#### Issue: Native module errors

```bash
# Rebuild native modules for Electron
npm run rebuild

# Or manually
npx electron-rebuild
```

#### Issue: WebSocket connection failures

**Check**:
1. Runtime is actually running: `await window.datalayerClient.getRuntime(podName)`
2. WebSocket proxy logs in main process
3. Token is valid and not expired

**Debug WebSocket proxy**:

```typescript
// In src/main/services/websocket-proxy.ts
// Logs are already enabled:
log.debug(`[WebSocket Proxy] Opening connection to ${url}`);
log.debug(`[WebSocket Proxy] Connection ${id} opened`);
log.error(`[WebSocket Proxy] Connection ${id} error:`, error);
```

---

## Troubleshooting

### Build Failures

#### TypeScript Errors

```bash
# Check types without building
npm run type-check

# Common fixes
npm install              # Update dependencies
rm -rf node_modules      # Clean install
npm install
```

#### Vite Build Errors

```bash
# Clean everything
rm -rf dist dist-electron node_modules/.vite
npm install
npm run build
```

### Runtime Errors

#### "App doesn't start" in development

**Check**:
1. Port 5173 is not in use: `lsof -i :5173`
2. No TypeScript errors: `npm run type-check`
3. Dependencies installed: `npm install`

**Logs**:
- Check terminal output
- Check `~/Library/Logs/Datalayer Desktop/main.log`

#### Linux: Electron Sandbox Error

**Error**:
```
FATAL:setuid_sandbox_host.cc(163)] The SUID sandbox helper binary was found, but is not configured correctly.
```

**Root Cause**: Electron's sandboxing requires root ownership and setuid permissions on Linux, which is incompatible with development in user directories.

**Solutions** (already implemented):
1. **Automatic** - The app automatically disables sandbox in development mode on Linux
2. **Package scripts** - `npm start` and `npm run dev` set `ELECTRON_DISABLE_SANDBOX=1`
3. **Manual override** - If needed: `export ELECTRON_DISABLE_SANDBOX=1`

**Security Note**: Sandbox is **only disabled in development mode**. Production builds maintain full sandboxing for security.

**Additional Linux Setup** (if you encounter build issues):
```bash
# Install build tools (required for native modules like bufferutil)
sudo apt-get update
sudo apt-get install build-essential

# If using Python 3.12+, you may need distutils
sudo apt-get install python3-setuptools

# Or use Python 3.11 for better compatibility
conda install python=3.11
```

#### "App doesn't start" in production

**Check**:
1. Built files exist: `ls -la dist/`
2. electron-builder succeeded: check `dist-electron/`

**Debug**:
```bash
# Run built app directly
./dist-electron/mac/Datalayer\ Desktop.app/Contents/MacOS/Datalayer\ Desktop
```

### Authentication Issues

#### Linux: Token Not Persisting Between Restarts

**Symptom**: You have to log in every time you start the app on Ubuntu/Linux.

**Root Cause**: Electron's `safeStorage` requires a system keyring service (`gnome-keyring` or `kwallet`) which may not be installed or running.

**Solution** (already implemented as of January 2025):
- The app automatically falls back to base64-encoded file storage when system encryption is unavailable
- Check the logs to confirm: Look for `"Token saved with fallback encoding"`

**Optional: Install system keyring for better security**:
```bash
# For GNOME/Ubuntu
sudo apt-get install gnome-keyring
# Make sure it's running
gnome-keyring-daemon --start

# For KDE/Kubuntu
sudo apt-get install kwalletmanager
```

**Verify token storage**:
```bash
# Token file location (check after logging in)
ls -la ~/.config/Datalayer\ Desktop/.datalayer-token

# Check logs for storage method used
cat ~/Library/Logs/Datalayer\ Desktop/main.log | grep "Token saved"
# Linux: ~/.config/Datalayer Desktop/logs/main.log
```

#### Can't log in

**Check**:
1. Token is valid: Test in browser at `https://prod1.datalayer.run/api/iam/v1/whoami`
2. Network connectivity: `ping prod1.datalayer.run`
3. DevTools Network tab: Look for failed requests

#### Logout doesn't work

**Debug**:
```typescript
// Check if logout IPC is called
console.log('Calling logout...');
await window.datalayerClient.logout();
console.log('Logout complete');
```

**Check**:
- Auth state change event is fired
- Token file is deleted: `ls ~/.config/Datalayer\ Desktop/.datalayer-token` (should not exist after logout)

### Performance Issues

#### Slow startup

**Optimize**:
1. Check component preloading is working
2. Reduce parallel preload tasks
3. Lazy load more components

**Debug**:
```typescript
// Add timing logs in App.tsx
console.time('Auth check');
await window.datalayerClient.getAuthState();
console.timeEnd('Auth check');
```

#### Slow notebook execution

**Check**:
1. Runtime is ready (not still starting)
2. Network latency to Jupyter server
3. Kernel is responsive: Check kernel status in UI

### Memory Leaks

#### Symptoms
- App gets slower over time
- Memory usage grows continuously

**Common causes**:
1. Event listeners not cleaned up
2. ServiceManager not disposed
3. Runtimes not terminated

**Fix**:
```typescript
// Always clean up in useEffect
useEffect(() => {
  const listener = () => { /* ... */ };
  window.addEventListener('event', listener);

  return () => {
    window.removeEventListener('event', listener);
  };
}, []);

// Always dispose ServiceManager
await serviceManager.dispose();

// Always terminate runtimes
await terminateRuntime(notebookId);
```

### Getting Help

**Before asking for help**, collect this info:

1. **Version**: Run the app, check "About" dialog
2. **Platform**: macOS version, Windows version, Linux distro
3. **Node.js version**: `node --version`
4. **Error logs**:
   - Terminal output
   - Main process logs (`~/Library/Logs/Datalayer Desktop/main.log`)
   - DevTools console
5. **Steps to reproduce**: Exact steps that cause the issue

**Where to get help**:
- **Discord**: [Join our Discord](https://discord.gg/datalayer)
- **GitHub Issues**: [Report bugs](https://github.com/datalayer/desktop/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/datalayer/desktop/discussions)

---

## CI/CD Workflows

The project uses GitHub Actions for continuous integration and deployment. All workflows are located in `.github/workflows/`.

### Available Workflows

#### 1. Tests (`test.yml`)

**Triggers**: Push to main, pull requests, manual dispatch

**Jobs**:
- **unit-tests**: Runs Vitest unit tests on Ubuntu
- **integration-tests**: Runs integration tests on Ubuntu
- **e2e-tests**: Runs Playwright E2E tests on Ubuntu, macOS, and Windows
- **coverage**: Generates coverage report and checks thresholds

**Commands**:
```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # E2E tests with Playwright
npm run test:coverage   # All tests with coverage
```

**Coverage Thresholds**:
- Lines: 60%
- Functions: 60%
- Branches: 55%
- Statements: 60%

#### 2. Build (`build.yml`)

**Triggers**: Push to main, pull requests, tags, manual dispatch

**Matrix**: Builds for all platforms and architectures
- Linux (x64)
- Windows (x64)
- macOS Universal (Intel + Apple Silicon)
- macOS Intel only (x64)
- macOS Apple Silicon only (arm64)

**Artifacts**: Generated installers (.dmg, .exe, .AppImage, .deb, .rpm)

#### 3. Code Quality (`code-quality.yml`)

**Triggers**: Push to main, pull requests, manual dispatch

**Jobs**:
- **format-check**: Prettier formatting validation
- **lint-check**: ESLint with `--max-warnings 0`
- **type-check**: TypeScript type checking

#### 4. Documentation (`docs.yml`)

**Triggers**: Push to main, pull requests, manual dispatch

**Output**: TypeDoc API documentation deployed to Netlify

#### 5. Release (`release.yml`)

**Triggers**: Push tags matching `v*` pattern

**Process**:
1. Builds for all platforms
2. Creates GitHub Release
3. Uploads installers as release assets
4. Auto-generates changelog

### Running CI Locally

**Test like CI**:
```bash
# Format check
npm run format:check

# Lint with strict warnings
npm run lint -- --max-warnings 0

# Type check
npm run type-check

# Run all tests
npm run test:ci
```

**Build like CI**:
```bash
# Clean environment
rm -rf node_modules dist dist-electron
npm install

# Build
npm run build

# Package (example for macOS)
npm run dist:mac-universal
```

### Workflow Configuration

All workflows use the reusable action `.github/actions/setup-environment` which:
1. Sets up Node.js 22
2. Installs desktop dependencies
3. Clones and builds core SDK from `goanpeca/core` (branch: `sdk/core-updates`)
4. Configures environment variables

### Debugging Failed Workflows

**Check logs**:
1. Go to Actions tab on GitHub
2. Click failed workflow
3. Expand failing job
4. Review step logs

**Common failures**:
- **Lint errors**: Run `npm run lint:fix` locally
- **Type errors**: Run `npm run type-check` and fix issues
- **Test failures**: Run `npm test` locally to reproduce
- **Build failures**: Check `build-logs-*` artifacts for detailed errors

---

## Additional Resources

### Documentation
- [README.md](README.md) - User-facing documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [RELEASE.md](RELEASE.md) - Release process
- [CLAUDE.md](CLAUDE.md) - Detailed technical notes and troubleshooting

### External Documentation
- [Electron Docs](https://www.electronjs.org/docs) - Electron API reference
- [Vite Docs](https://vitejs.dev) - Vite build tool
- [JupyterLab Services](https://github.com/jupyterlab/jupyterlab/tree/master/packages/services) - Kernel management
- [Lexical Editor](https://lexical.dev) - Rich text editor
- [Zustand](https://github.com/pmndrs/zustand) - State management

### API Documentation
- [TypeDoc](https://datalayer-desktop.netlify.app) - Auto-generated API docs (deployed on Netlify)

---

**Questions or issues with this guide?** Please open an issue or discussion on GitHub!
