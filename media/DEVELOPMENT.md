# Development Guide

This guide covers the technical details for developing and building the Datalayer Desktop application.

## Prerequisites

- Node.js 22+ and npm (Node.js 22 LTS recommended for better ESM support)
- Git
- Platform-specific build tools:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Windows Build Tools
  - **Linux**: build-essential

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/datalayer/desktop.git
cd desktop
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment (Optional)

For cloud features, create a `.env` file:

```bash
cp .env.example .env
# Edit .env with your credentials:
# DATALAYER_RUN_URL=https://prod1.datalayer.run
# DATALAYER_TOKEN=your-api-token-here
```

### 4. Start Development Server

```bash
npm start  # or npm run dev
```

This starts the app with:
- Hot-reload enabled
- DevTools open
- Source maps for debugging
- Module resolution handled dynamically

## Available Scripts

```bash
# Development
npm start                # Start in development mode
npm run dev             # Same as npm start

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run format          # Format with Prettier
npm run format:check    # Check formatting
npm run type-check      # TypeScript type checking
npm run check           # Run all checks
npm run check:fix       # Fix all auto-fixable issues

# Building
npm run build           # Build for production
npm run rebuild         # Rebuild native modules

# Documentation
npm run docs            # Build TypeDoc documentation
npm run docs:watch      # Build docs with watch mode

# Testing
npm test                # Run tests (when available)
```

## Architecture Overview

### Process Architecture

The application follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────┐
│           Main Process (Node.js)         │
│  - Window management                     │
│  - IPC handlers                         │
│  - API proxy service                    │
│  - WebSocket proxy                      │
└─────────────────┬───────────────────────┘
                  │ IPC
┌─────────────────▼───────────────────────┐
│         Preload Scripts                  │
│  - Context bridge                       │
│  - Secure API exposure                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Renderer Process (Chromium)         │
│  - React application                     │
│  - Jupyter integration                   │
│  - UI components                        │
└──────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── main/               # Main process code
│   ├── index.ts       # Entry point, window management
│   └── services/      # Backend services
├── preload/           # Preload scripts
│   └── index.ts       # Context bridge setup
└── renderer/          # React application
    ├── main.tsx       # React entry point
    ├── App.tsx        # Main app component
    ├── components/    # UI components
    ├── pages/         # Page components
    ├── services/      # Frontend services
    ├── stores/        # State management
    ├── hooks/         # Custom React hooks
    ├── utils/         # Utilities
    └── polyfills/     # Browser polyfills
```

## Key Technologies

- **Electron** - Desktop application framework
- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Zustand** - State management
- **@jupyterlab/services** - Jupyter kernel management
- **@datalayer/jupyter-react** - Jupyter React components
- **Lexical** - Rich text editor for documents

## Module System & Polyfills

The application handles complex module resolution for the Jupyter ecosystem:

### Polyfill Loading Order

Polyfills must load in this exact order (handled by `src/renderer/polyfills/index.ts`):

1. **Symbol** - React requires Symbol.for
2. **Lodash numbered** - For bundled lodash variations
3. **Lodash internals** - Data structures for lodash
4. **Lodash globals** - Global _ and Backbone
5. **RequireJS** - AMD module compatibility
6. **JupyterLab proxy** - Service resolution

### Vite Configuration

The `electron.vite.config.ts` handles:
- CommonJS/ESM interop
- Module aliasing
- Path polyfills
- Dynamic imports

## Security Architecture

### Context Isolation

- Renderer process has no direct Node.js access
- All system APIs go through preload scripts
- IPC validates all messages

### Content Security Policy

- External API calls routed through main process
- WebSocket connections proxied through IPC
- Strict script execution policies

### API Proxy Architecture

```
Renderer → IPC → Main Process → External API
         ↑                    ↓
         └────── Response ────┘
```

## State Management

### Runtime Store (`runtimeStore.ts`)

Manages compute runtime lifecycle:
- Creation/termination
- Service manager instances
- Cleanup on termination

### Environment Store (`environmentStore.ts`)

Handles available computing environments:
- Environment listing
- Selection state
- Resource configurations

## Debugging Tips

### Development Mode Issues

1. **Module not found**: Clear Vite cache
   ```bash
   rm -rf node_modules/.vite
   ```

2. **Native module issues**: Rebuild
   ```bash
   npm run rebuild
   ```

3. **Console noise**: Already filtered in `App.tsx`

### Production Build Issues

1. **Clean everything**:
   ```bash
   rm -rf dist dist-electron node_modules/.vite
   npm install
   npm run build
   ```

2. **Check module resolution**: See `jupyterlab-proxy.js`

3. **Lodash errors**: Verify polyfills are loaded

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Module not found" | Missing dependency | `npm install` |
| "Cannot find ServiceManager" | Module resolution | Check jupyterlab-proxy.js |
| "Symbol.for is not a function" | Polyfill order | Verify symbol polyfill loads first |
| "Widget is not attached" | Cleanup timing | Ignore (handled globally) |

## Performance Optimization

### Bundle Size

- Lazy load heavy components
- Use dynamic imports for routes
- Tree-shake unused code

### Runtime Performance

- Preload components during auth
- Cache API responses
- Virtualize long lists

### Memory Management

- Dispose kernels properly
- Clean up event listeners
- Clear runtime state on termination

## Testing

### Unit Tests

```bash
npm test
```

### Manual Testing Checklist

- [ ] App starts in development
- [ ] Can authenticate
- [ ] Can list environments
- [ ] Can create/open notebooks
- [ ] Can execute code cells
- [ ] Can terminate runtimes
- [ ] Production build works

## Troubleshooting

### Port Conflicts

WebSocket proxy uses port 8889. If occupied:
```bash
lsof -i :8889  # Find process
kill -9 <PID>  # Kill process
```

### Authentication Issues

1. Check credentials in `.env`
2. Verify network connectivity
3. Check DevTools Network tab

### Kernel Connection Issues

1. Verify runtime is running
2. Check WebSocket proxy logs
3. Ensure token is valid

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Vite Documentation](https://vitejs.dev)
- [JupyterLab Extension Guide](https://jupyterlab.readthedocs.io)
- [TypeDoc Documentation](https://typedoc.org)

## Getting Help

- **Discord**: [Join our Discord](https://discord.gg/datalayer)
- **GitHub Issues**: [Report bugs](https://github.com/datalayer/desktop/issues)
- **Discussions**: [Ask questions](https://github.com/datalayer/desktop/discussions)