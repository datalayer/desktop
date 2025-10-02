# Testing Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

This will install:
- Vitest 2.1.8 (test runner)
- @testing-library/react 16.1.0 (React testing utilities)
- @playwright/test 1.49.1 (E2E testing)
- happy-dom 15.11.7 (fast DOM environment)
- msw 2.7.0 (API mocking)
- And more...

### 2. Run the Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (recommended for development)
npm run test:watch

# Run with coverage
npm run test:coverage

# Run with UI (visual test runner)
npm run test:ui
```

### 3. Check the Results

You should see output like:
```
✓ src/renderer/utils/logger.test.ts (5 tests)
✓ src/renderer/components/auth/Button.test.tsx (9 tests)
✓ src/renderer/stores/environmentStore.test.ts (15 tests)
✓ src/renderer/components/notebook/ErrorBoundary.test.tsx (13 tests)

Test Files  4 passed (4)
     Tests  42 passed (42)
  Start at  10:30:45
  Duration  2.34s
```

## 📝 Write Your First Test

### 1. Create a Test File

Tests should be colocated with source files:
```
src/
└── renderer/
    └── components/
        └── MyComponent.tsx
        └── MyComponent.test.tsx  ← Create this
```

### 2. Write a Simple Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render text', () => {
    render(<MyComponent text="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 3. Run Your Test

```bash
npm run test:watch
```

The test will run automatically when you save!

## 🧪 Common Testing Patterns

### Testing User Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should handle clicks', async () => {
  const handleClick = vi.fn();
  const user = userEvent.setup();

  render(<Button onClick={handleClick} />);

  await user.click(screen.getByRole('button'));

  expect(handleClick).toHaveBeenCalled();
});
```

### Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react';

it('should load data', async () => {
  render(<MyComponent />);

  await waitFor(() => {
    expect(screen.getByText('Loaded!')).toBeInTheDocument();
  });
});
```

### Testing Zustand Stores

```typescript
import { renderHook, act } from '@testing-library/react';

it('should update state', () => {
  const { result } = renderHook(() => useMyStore());

  act(() => {
    result.current.setValue('new value');
  });

  expect(result.current.value).toBe('new value');
});
```

### Using Mocks

```typescript
import { setupDatalayerAPIMocks, mockDatalayerClient } from '@tests/mocks';

beforeEach(() => {
  setupDatalayerAPIMocks();

  // Customize mock response
  mockDatalayerClient.listEnvironments.mockResolvedValue([...]);
});
```

### Using Fixtures

```typescript
import { mockUser, mockEnvironments } from '@tests/fixtures';

it('should display user info', () => {
  render(<UserProfile user={mockUser} />);
  expect(screen.getByText(mockUser.email)).toBeInTheDocument();
});
```

## 🔧 Debugging Tests

### 1. Use `screen.debug()`

```typescript
it('should render something', () => {
  render(<MyComponent />);
  screen.debug(); // Prints the DOM to console
});
```

### 2. Use `console.log` in Tests

```typescript
it('should work', () => {
  const result = someFunction();
  console.log('Result:', result);
  expect(result).toBe(expected);
});
```

### 3. Run Single Test

```typescript
// Add .only to run just this test
it.only('should test something', () => {
  // ...
});
```

### 4. Skip Tests

```typescript
// Add .skip to skip a test
it.skip('should test something', () => {
  // ...
});
```

## 📊 View Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html
```

Coverage thresholds:
- Lines: 60%
- Functions: 60%
- Branches: 55%
- Statements: 60%

## 🎯 What to Test

### ✅ DO Test:
- User interactions (clicks, typing, form submission)
- Data display and transformations
- Error states and loading states
- Accessibility (ARIA attributes, keyboard navigation)
- State management (Zustand stores)
- API integration (with mocked APIs)

### ❌ DON'T Test:
- Implementation details (internal state, private methods)
- Third-party libraries (React, Primer, etc.)
- Styling (unless critical to functionality)

## 🐛 Common Issues

### "Cannot find module '@tests/mocks'"

**Fix**: Check `tsconfig.json` includes path aliases:
```json
{
  "compilerOptions": {
    "paths": {
      "@tests/*": ["./tests/*"]
    }
  }
}
```

### "ResizeObserver is not defined"

**Fix**: This is mocked in `tests/setup.ts`. Make sure it's imported.

### "window is not defined"

**Fix**: Tests run in happy-dom which provides `window`. Check that your test imports the component correctly.

### Tests are slow

**Fix**:
1. Use `vi.mock()` for expensive operations
2. Don't use `setTimeout` or `setInterval` in tests
3. Run tests in parallel (default in Vitest)

## 📚 More Resources

- **Full Documentation**: [tests/README.md](tests/README.md)
- **Test Summary**: [TEST_SUMMARY.md](TEST_SUMMARY.md)
- **Vitest Docs**: https://vitest.dev
- **Testing Library**: https://testing-library.com
- **Playwright**: https://playwright.dev

## 🎉 You're Ready!

Start writing tests and let the test runner guide you. Happy testing! 🚀

---

**Pro Tip**: Run `npm run test:watch` in a terminal and keep it open while coding. Tests will run automatically as you save files!
