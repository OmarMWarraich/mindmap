---
description: "Use when writing or reviewing TypeScript code. Covers type definitions, Zod schemas, import style, naming conventions, and tsconfig constraints for this project."
applyTo: "lib/**/*.ts", "app/**/*.ts", "components/**/*.tsx", "workers/**/*.ts"
---

# TypeScript & Code Style

## Types

- **Derive types from Zod schemas** using `z.infer<>` — do not write redundant hand-typed interfaces for validated data.
- **Derive types from Drizzle tables** using `.$inferSelect` / `.$inferInsert` — do not duplicate column definitions as interfaces.

```typescript
// Preferred
export const mindmapNodeSchema = z
  .object({ id: z.string(), label: z.string() })
  .strict();
export type MindmapNode = z.infer<typeof mindmapNodeSchema>;

// Preferred
export type User = typeof users.$inferSelect;
```

## Zod Schemas

- Always call `.strict()` on object schemas to reject unknown properties.
- Use `.superRefine()` for cross-field validation; add issue at the relevant path.
- Define a `requiredString` helper (non-empty `z.string().min(1)`) and reuse it.

## Imports

- Use `import type { ... }` for type-only imports.
- Include the `.ts` extension in relative imports (e.g. `from './ast.ts'`).
- Order: external packages → relative imports.

```typescript
import type { MindmapRootAstNode } from "./ast.ts";
import { MINDMAP_DSL_ROOT_PREFIX } from "./mvp.ts";
```

- No barrel files (`index.ts` re-exports). Import the specific module directly.

## Naming

| Kind               | Convention            | Example                                       |
| ------------------ | --------------------- | --------------------------------------------- |
| Types / Interfaces | PascalCase            | `MindmapValidationCode`, `GeneratedMindmap`   |
| Constants          | UPPER_SNAKE_CASE      | `MINDMAP_DSL_ROOT_PREFIX`                     |
| Functions          | camelCase, verb-first | `parseMindmapDsl()`, `buildSvgPreviewModel()` |
| Files (utilities)  | kebab-case            | `from-ast.ts`, `svg-preview.ts`               |
| Files (components) | PascalCase            | `StudyWorkspace.tsx`                          |

## tsconfig Constraints

- `strict: true` — never disable strictness flags.
- `moduleResolution: "bundler"` — do not use `require()` or CommonJS patterns.
- Path alias `@/*` maps to workspace root — use `@/*` when importing across top-level directories (e.g. `app/` importing from `lib/`); use relative paths when both files are in the same immediate directory.
- `allowImportingTsExtensions: true` — always include the `.ts`/`.tsx` extension.

## General

- Add explicit return types to all exported functions in `lib/**` and `workers/**`. Components in `components/**` are exempt unless they return non-JSX values.
- Avoid `any`; use `unknown` and narrow with type guards.
- Use discriminated unions (a `kind` or `type` literal field) for variant types.
- For fallible operations, prefer returning a discriminated union `{ ok: true; value: T } | { ok: false; error: string }` over throwing. When catching exceptions, type the caught value as `unknown` and narrow before use.
- Prefer `z.enum([...])` for string enums validated at runtime; prefer `as const` objects with a derived union type (`type Foo = typeof FOO[keyof typeof FOO]`) for compile-time-only enums. Avoid the TypeScript `enum` keyword.
