# Testing Strategy

This document defines the testing rules and practices for the Sauna Control System.

---

## Test Pyramid

```
┌─────────────────────────────────┐
│         E2E Tests (Few)         │  ← Critical user journeys only
├─────────────────────────────────┤
│    Integration Tests (Some)     │  ← API endpoints, service boundaries
├─────────────────────────────────┤
│      Unit Tests (Many)          │  ← Pure functions, transformations
└─────────────────────────────────┘
```

| Level | What | Where | Mocking |
|-------|------|-------|---------|
| Unit | Pure functions | `__tests__/transform.test.ts` | None |
| Integration | API routes, services | `__tests__/api.test.ts`, `__tests__/service.test.ts` | External APIs only |
| E2E | User flows | `e2e/*.spec.ts` | External APIs only |

---

## Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| `transform.ts` | 100% | Pure functions are easy to test |
| `service.ts` | 80%+ | Mock external deps, test logic |
| API routes | 100% endpoints | Every route has happy + error case |
| E2E | Top 5 flows | MCB on/off, safety shutdown, SSE |

---

## Rules

### T1. Test Pure Functions in Isolation
Every function in `transform.ts` gets its own test block:
- 1 happy path
- 1 edge case  
- 1 error/invalid input

### T2. No Mocking in Unit Tests
Pure functions have no dependencies. If you need to mock, it's an integration test.

### T3. Test API Endpoints with Real Routing
Use Hono's `app.request()` for testing actual route handling:
```typescript
const res = await app.request("/api/health");
expect(res.status).toBe(200);
```

### T4. Mock External Dependencies at Service Boundary
Mock only:
- Tuya Cloud API
- Local MCB API  
- Smart Meter API
- WAHA API
- MQTT broker

Never mock internal modules.

### T5. Test Names Describe Behavior
```typescript
// Bad
test('turnMcbOn')

// Good
test('turnMcbOn returns success when Tuya Cloud responds with 200')
test('turnMcbOn returns AUTH_FAILED when access token is invalid')
```

### T6. Arrange-Act-Assert Structure
```typescript
test('checkThresholds returns exceeds:true when L1 > threshold', () => {
  // Arrange
  const phaseData = { l1: 26, l2: 10, l3: 15 };
  const threshold = 25;

  // Act
  const result = checkThresholds(phaseData, threshold);

  // Assert
  expect(result.exceeds).toBe(true);
});
```

### T7. Tests Run on Every Change
```bash
bun test --watch  # During development
bun test          # Before commit
```

### T8. Failed Tests Block Deployment
All tests must pass. No `test.skip()` without linked issue.

---

## Test Organization

```
src/
└── mcb/
    ├── schema.ts
    ├── transform.ts
    ├── service.ts
    └── __tests__/
        ├── transform.test.ts     # Unit tests (existing)
        ├── service.test.ts       # Service tests (mocked HTTP)
        └── api.test.ts           # API endpoint tests

src/
└── api/
    └── __tests__/
        └── routes.test.ts        # All API route tests

e2e/
├── dashboard.spec.ts             # Future: Playwright tests
└── mcb-control.spec.ts
```

---

## What NOT to Test

- Third-party library internals (Hono routing, Zod parsing)
- Framework behavior (SSE spec compliance)
- Trivial getters/setters
- Type definitions (TypeScript handles this)

---

## Running Tests

**IMPORTANT:** Use `bun run test`, NOT `bun test` (see LEARNINGS.md L21)

```bash
# Run all tests (uses Vitest via package.json script)
bun run test

# Or directly with npx
npx vitest run

# Run specific module
npx vitest run src/mcb

# Watch mode
bun run test:watch
# or: npx vitest

# Type checking (always run before commit)
bun run typecheck
```

**Why not `bun test`?**
- `bun test` uses Bun's built-in test runner
- Our tests use Vitest APIs (`vi.mock`, `vi.stubGlobal`, `vi.mocked`)
- These APIs don't exist in Bun's test runner
- Always use the package.json scripts to ensure Vitest is used

