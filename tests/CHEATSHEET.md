# Testing Cheatsheet

Quick reference for common testing patterns in Datalayer Desktop.

## 🚀 Running Tests

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:ui             # Visual test runner
npm run test:coverage       # With coverage
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests only
```

## 📝 Basic Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

## 🎯 Testing React Components

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Render component
render(<MyComponent prop="value" />);

// Query elements
screen.getByText('text')
screen.getByRole('button')
screen.getByLabelText('label')
screen.queryByText('text') // Returns null if not found
screen.findByText('text')  // Async, waits for element

// User interactions
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
await user.keyboard('{Enter}');

// Assertions
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeDisabled();
expect(element).toHaveAttribute('aria-label', 'value');
```

## 🏪 Testing Zustand Stores

```typescript
import { renderHook, act } from '@testing-library/react';

const { result } = renderHook(() => useMyStore());

// Read state
expect(result.current.value).toBe('initial');

// Update state
act(() => {
  result.current.setValue('new');
});

// Async operations
await act(async () => {
  await result.current.fetchData();
});
```

## 🎭 Using Mocks

### Setup Mocks
```typescript
import { setupDatalayerAPIMocks, mockDatalayerClient } from '@tests/mocks';

beforeEach(() => {
  setupDatalayerAPIMocks();
});
```

### Customize Mock Responses
```typescript
mockDatalayerClient.listEnvironments.mockResolvedValue([...]);
mockDatalayerClient.createRuntime.mockRejectedValue(new Error('Failed'));
```

### Mock Functions
```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue('async value');
mockFn.mockRejectedValue(new Error('error'));

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg');
expect(mockFn).toHaveBeenCalledTimes(2);
```

## 🔧 Using Fixtures

```typescript
import { mockUser, mockEnvironments, mockRuntimes } from '@tests/fixtures';

render(<UserProfile user={mockUser} />);
expect(result).toEqual(mockEnvironments[0]);
```

## ⏱️ Async Testing

```typescript
import { waitFor } from '@testing-library/react';

// Wait for assertion
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// Wait for async operation
await act(async () => {
  await result.current.fetchData();
});

// With custom timeout
await waitFor(() => {
  expect(condition).toBe(true);
}, { timeout: 5000 });
```

## 🐛 Debugging

```typescript
// Print DOM
screen.debug();
screen.debug(screen.getByRole('button'));

// Log in test
console.log('Debug:', value);

// Run single test
it.only('should test this', () => {});

// Skip test
it.skip('should skip this', () => {});

// Increase timeout
it('slow test', async () => {}, { timeout: 10000 });
```

## 🎨 Common Matchers

```typescript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).not.toBe(unexpected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThan(10);
expect(value).toBeCloseTo(0.3);

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(object).toHaveProperty('key');
expect(object).toMatchObject({ key: 'value' });

// Functions
expect(fn).toThrow();
expect(fn).toThrow('error message');

// Promises
await expect(promise).resolves.toBe('value');
await expect(promise).rejects.toThrow();
```

## 🔑 Testing Library Queries

```typescript
// Priority order (use in this order when possible):

// 1. Accessible by everyone
getByRole('button', { name: /submit/i })
getByLabelText('Username')
getByPlaceholderText('Enter email')
getByText('Click me')
getByDisplayValue('Current value')

// 2. Semantic queries
getByAltText('Image description')
getByTitle('Tooltip text')

// 3. Test IDs (use as last resort)
getByTestId('custom-element')

// Query variants:
getBy...    // Throws if not found
queryBy...  // Returns null if not found
findBy...   // Async, waits for element

// Multiple elements:
getAllBy...
queryAllBy...
findAllBy...
```

## 🎯 Best Practices

### ✅ DO
- Test user behavior, not implementation
- Use accessible queries (getByRole, getByLabelText)
- Mock external dependencies
- Clean up after tests
- Use descriptive test names

### ❌ DON'T
- Test implementation details
- Use test IDs unless necessary
- Test library code
- Make tests dependent on each other
- Use timeouts instead of waitFor

## 📊 Coverage

```bash
# Generate coverage
npm run test:coverage

# View report
open coverage/index.html

# Check specific file
npm test -- src/path/to/file.test.ts --coverage
```

## 🎓 Example Tests

### Component Test
```typescript
describe('Button', () => {
  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Store Test
```typescript
describe('environmentStore', () => {
  it('should fetch environments', async () => {
    const { result } = renderHook(() => useEnvironmentStore());

    await act(async () => {
      await result.current.fetchEnvironmentsIfNeeded();
    });

    expect(result.current.environments).toHaveLength(3);
  });
});
```

### Integration Test
```typescript
describe('Authentication Flow', () => {
  it('should login and store token', async () => {
    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.login('test-token');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });
});
```

---

**Pro Tips**:
- Use `test:watch` for fast feedback during development
- Use `test:ui` to see tests visually
- Check `tests/README.md` for detailed guide
- See `TEST_SUMMARY.md` for implementation details
