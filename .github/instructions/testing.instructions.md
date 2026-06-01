---
description: "Use when writing, editing, or reviewing tests. Covers test runner, assertion style, mock patterns, fixtures, and snapshot naming for this project."
applyTo: "**/*.test.ts"
---

# Testing Conventions

## Framework

- Use Node's built-in `node:test` — **not** Jest or Vitest.
- Use `node:assert/strict` for all assertions.
- Run tests with `node --test --experimental-test-module-mocks`.

## Structure

- Flat `test()` declarations — no `describe()` blocks.
- Test names describe expected behavior in plain English.

```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("parseMindmapDsl returns root node for valid input", () => {
  const result = parseMindmapDsl("@root: Photosynthesis\n");
  assert.equal(result.ast?.root.label, "Photosynthesis");
});
```

## Assertions

Prefer the most specific assertion available:

| Situation          | Use                                                 |
| ------------------ | --------------------------------------------------- |
| Deep equality      | `assert.deepEqual(actual, expected)`                |
| Primitive equality | `assert.equal(actual, expected)`                    |
| Truthiness         | `assert.ok(value)`                                  |
| Pattern match      | `assert.match(string, /regex/)`                     |
| Throws             | `assert.throws(() => fn(), /message/)`              |
| Async rejection    | `await assert.rejects(async () => fn(), /message/)` |

## Mocking / Dependency Injection

- Inject test doubles through optional function parameters (`fetchImpl`, `env`, etc.) — do not monkey-patch globals.

```typescript
const result = await requestInlineCompletionFromApi(payload, {
  fetchImpl: async (_input, _init) =>
    new Response(
      JSON.stringify({ completionText: "ATP synthase", source: "model" }),
    ),
});
```

For timer-dependent code, inject a clock parameter (e.g. `clockImpl`) that wraps `Date.now` and `setTimeout`, following the same optional-parameter DI pattern used for `fetchImpl`.

## Fixtures

- Store fixtures in a `__fixtures__/` sub-directory next to the module under test.
- Import them explicitly by name; do not embed multi-line strings or any string longer than ~80 characters inline in test files; store them in `__fixtures__` instead.

```typescript
import {
  validMindmapDslFixture,
  malformedMindmapDslFixtures,
} from "./__fixtures__/parse-fixtures.ts";
```

## Async Tests

- Mark the test callback `async` and `await` the result — no special wrapper needed.

## Snapshot Tests

- Name snapshot test files `*.snapshot.test.ts`.
- Keep them next to the module they cover (e.g. `from-ast.snapshot.test.ts`).

## Integration / Smoke Tests

- Smoke tests may read source files at runtime using `readFileSync(new URL(path, import.meta.url), 'utf8')`.
- Use regex assertions (`assert.match`) to verify structural invariants without tight coupling to exact output.
