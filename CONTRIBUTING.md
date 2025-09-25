# Contributing to Datalayer Desktop

Thank you for your interest in contributing to Datalayer Desktop! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report:
1. Check the [existing issues](https://github.com/datalayer/desktop/issues)
2. Try the latest version
3. Collect relevant information

Create a bug report with:
- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment details (OS, Node version, etc.)

### Suggesting Features

Feature requests should include:
- Clear use case explanation
- Why existing features don't solve it
- Possible implementation approach
- Mockups/examples if applicable

### Pull Requests

1. **Fork & Clone**
   ```bash
   git clone https://github.com/your-username/desktop.git
   cd desktop
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

3. **Make Changes**
   - Follow the coding standards
   - Add tests if applicable
   - Update documentation

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   # or
   git commit -m "fix: resolve issue with..."
   ```

5. **Push & Create PR**
   ```bash
   git push origin your-branch-name
   ```

## Development Setup

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions.

Quick start:
```bash
npm install
npm start
```

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow existing code style
- Use meaningful variable names
- Add TypeDoc comments for public APIs

```typescript
/**
 * Calculate the sum of two numbers.
 *
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

### React Components

- Use functional components with hooks
- Keep components focused and small
- Use proper TypeScript props interfaces

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  disabled = false
}) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

### File Organization

```
src/renderer/
├── components/     # Reusable UI components
│   └── [feature]/  # Feature-specific components
├── pages/          # Page-level components
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── services/       # API and service layers
└── stores/         # State management
```

## Code Quality Checks

Before submitting a PR, run:

```bash
# Format code
npm run format

# Lint code
npm run lint:fix

# Type check
npm run type-check

# Run all checks
npm run check:fix
```

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Place test files next to the code they test
- Name test files with `.test.ts` or `.spec.ts`
- Write clear test descriptions

```typescript
describe('Calculator', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });
});
```

## Documentation

### Code Documentation

Add TypeDoc comments to:
- All exported functions
- Public class methods
- Component props interfaces
- Complex algorithms

### README Updates

Update README.md when:
- Adding new features
- Modifying system requirements

### API Documentation

The project uses TypeDoc:
```bash
npm run docs
```

## Review Process

1. **Automated Checks** - CI runs on all PRs
2. **Code Review** - Maintainer reviews code
3. **Testing** - Manual testing if needed
4. **Merge** - Squash and merge to main

## Release Process

See [RELEASE.md](RELEASE.md) for release procedures.

## Getting Help

- **Discord**: [Join our Discord](https://discord.gg/datalayer)
- **Discussions**: [GitHub Discussions](https://github.com/datalayer/desktop/discussions)
- **Issues**: [GitHub Issues](https://github.com/datalayer/desktop/issues)

## License

By contributing, you agree that your contributions will be licensed under the BSD-3-Clause License.

---

Thank you for contributing to Datalayer Desktop! 🎉
