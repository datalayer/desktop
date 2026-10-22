# Datalayer Desktop Test Suite

Comprehensive test suite for the Datalayer Desktop Electron application.

## 📁 Directory Structure

```
tests/
├── README.md                  # This file
├── setup.ts                   # Global test setup
├── mocks/                     # Mock implementations
│   ├── index.ts              # Central export
│   ├── electron.ts           # Electron API mocks
│   ├── datalayer-api.ts      # Datalayer Client/API mocks
│   ├── websocket.ts          # WebSocket and proxy mocks
│   ├── loop.ts, loop, loop.cmd # The stub `loop` (a local runtime from fixtures)
│   ├── loop.test.ts          # The stub's own tests
│   └── iam.ts                # The stub IAM, Spacer and ai-agents (sign-in, Apps)
├── fixtures/                  # Test data
│   └── index.ts              # Mock users, environments, runtimes, etc.
└── e2e/                       # Playwright: the app launched from its build
    ├── app.ts                # launchApp, signInWithToken, windowUrls, menuLabels
    ├── launch.e2e.ts         # the window, no web page embedded, the menu, no token in a renderer
    ├── sign-in.e2e.ts        # a provider in the sign-in window, the typed token, sign-out, a relaunch
    ├── apps.e2e.ts           # the Apps tab: applications, Build, Try, Activity, Deployments
    └── sessions.e2e.ts       # the Sessions page lists and a row opens
```

## 🧪 Test Types

### Unit Tests (`*.test.ts`, `*.test.tsx`)
Fast, isolated tests for individual functions, components, and utilities.

**Location**: Colocated with source files (e.g., `Button.tsx` → `Button.test.tsx`)

**Examples**:
- `src/renderer/utils/logger.test.ts`
- `src/renderer/components/auth/Button.test.tsx`
- `src/renderer/stores/environmentStore.test.ts`

### Integration Tests (`*.integration.test.ts`, `*.integration.test.tsx`)
Tests that involve multiple components, services, or IPC communication.

**Location**: Colocated with related source files

**Examples** (coming soon):
- `src/main/services/datalayer-sdk-bridge.integration.test.ts`
- `src/renderer/pages/NotebookEditor.integration.test.tsx`

### E2E Tests (`*.e2e.ts`)
Full application tests using Playwright for Electron: the app launched from its build (`npm run build` first) with the stub `loop` on `PATH` and the stub IAM on loopback. See TESTING.md.

**Location**: `tests/e2e/`

## 🚀 Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Interactive UI
```bash
npm run test:ui
```

### CI Mode
```bash
npm run test:ci
```

## 📊 Coverage Targets

- **Overall**: 70%+
- **Critical Path** (auth, runtime, WebSocket): 90%+
- **Stores**: 85%+
- **Components**: 60%+

## 🛠️ Writing Tests

### Using Mocks

#### Electron APIs
```typescript
import { setupElectronMocks } from '@tests/mocks';

setupElectronMocks();
```

#### Datalayer APIs
```typescript
import { setupDatalayerAPIMocks, mockDatalayerClient } from '@tests/mocks';

setupDatalayerAPIMocks();

// Customize mock responses
mockDatalayerClient.listEnvironments.mockResolvedValue([...]);
```

#### WebSocket
```typescript
import { setupWebSocketMocks, MockWebSocket } from '@tests/mocks';

setupWebSocketMocks();
```

### Using Fixtures

```typescript
import { mockUser, mockEnvironments, mockRuntimes } from '@tests/fixtures';

// Use in your tests
expect(result).toEqual(mockUser);
```

### Testing React Components

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should handle clicks', async () => {
  const handleClick = vi.fn();
  const user = userEvent.setup();

  render(<Button onClick={handleClick} />);

  await user.click(screen.getByRole('button'));

  expect(handleClick).toHaveBeenCalled();
});
```

### Testing Zustand Stores

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyStore } from './myStore';

it('should update state', () => {
  const { result } = renderHook(() => useMyStore());

  act(() => {
    result.current.updateValue('new value');
  });

  expect(result.current.value).toBe('new value');
});
```

### Testing Async Operations

```typescript
it('should fetch data', async () => {
  const { result } = renderHook(() => useMyStore());

  await act(async () => {
    await result.current.fetchData();
  });

  expect(result.current.data).toBeDefined();
});
```

## 🎨 Best Practices

1. **Test Behavior, Not Implementation** - Focus on what the user sees/experiences
2. **Use Meaningful Test Names** - Describe the scenario being tested
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Mock External Dependencies** - Keep tests fast and isolated
5. **One Assertion Per Test** - Keep tests focused (when practical)
6. **Clean Up After Tests** - Reset mocks and state between tests
7. **Test Edge Cases** - Include error scenarios, empty states, etc.

## 📝 Test Naming Convention

```typescript
describe('ComponentName or featureName', () => {
  describe('method or scenario', () => {
    it('should do something when condition', () => {
      // test implementation
    });
  });
});
```

**Examples**:
- `should render with correct text`
- `should call onClick handler when clicked`
- `should display error message when fetch fails`
- `should be disabled when loading is true`

## 🔧 Troubleshooting

### Tests Fail in CI But Pass Locally
- Check for timing issues (use `waitFor` from Testing Library)
- Ensure proper cleanup between tests
- Check for environment-specific dependencies

### Mocks Not Working
- Ensure mocks are set up before imports
- Use `vi.mock()` at the top of test files
- Reset mocks in `beforeEach` or `afterEach`

### Async Tests Timing Out
- Increase timeout: `{ timeout: 30000 }`
- Use `waitFor` for async operations
- Check for unresolved promises

### Coverage Not Accurate
- Check `coverage.exclude` patterns in `vitest.config.ts`
- Ensure all code paths are tested
- Use `test:coverage` to see detailed report

## 📚 Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [Playwright for Electron](https://playwright.dev/docs/api/class-electron)
- [MSW (Mock Service Worker)](https://mswjs.io)

## 🎯 Test Development Roadmap

### Phase 1: Foundation ✅
- [x] Test infrastructure setup
- [x] Mock implementations
- [x] Test fixtures
- [x] First unit tests

### Phase 2: Core Logic (In Progress)
- [ ] Zustand stores (environment, runtime)
- [ ] SDK bridge
- [ ] WebSocket proxy
- [ ] IPC handlers

### Phase 3: Components
- [ ] Auth components
- [ ] Notebook components
- [ ] Page components
- [ ] Error boundaries

### Phase 4: Integration
- [ ] Authentication flow
- [ ] Runtime lifecycle
- [ ] WebSocket integration
- [ ] Collaboration

### Phase 5: E2E
- [ ] App launch
- [ ] Authentication flow
- [ ] Notebook workflow
- [ ] Error scenarios

---

**Last Updated**: January 2025
