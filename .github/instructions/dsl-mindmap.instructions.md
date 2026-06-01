---
description: "Use when working on the DSL parser, AST, validation, mindmap schema, layout engine, or SVG preview. Covers grammar rules, AST node kinds, validation codes, Zod schema structure, and layout defaults."
applyTo: "lib/dsl/**/*.ts", "lib/mindmap/**/*.ts", "workers/**/*.ts"
---

# DSL & Mindmap Domain Logic

## DSL Grammar

| Element     | Syntax               | Constraints                                                                                                            |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Root        | `@root: <label>`     | Must be the first non-empty line; exactly one per document                                                             |
| Branch      | `- @branch: <label>` | Top-level only; cannot be nested under leaves                                                                          |
| Leaf        | `- <label>`          | Can nest under branches or other leaves; no hard parser-enforced depth cap — avoid generating more than ~8 levels deep |
| Indentation | 2 spaces per level   | Spaces only — no tabs                                                                                                  |

```
@root: Photosynthesis
- @branch: Overview
  - Definition
  - Why it matters
- @branch: Light-dependent reactions
  - Location: thylakoid membrane
```

Constants are defined in `lib/dsl/mvp.ts`:

- `MINDMAP_DSL_ROOT_PREFIX = "@root: "`
- `MINDMAP_DSL_BRANCH_PREFIX = "- @branch: "`
- `MINDMAP_DSL_LEAF_PREFIX = "- "`
- `MINDMAP_DSL_INDENT = "  "`

## AST Node Kinds

```typescript
type MindmapAstNodeKind = "root" | "branch" | "leaf";
```

- Use discriminated union on `kind` when narrowing node types.
- Each node carries a `MindmapAstSource` (`line`, `column`, `indentLevel`, `raw`) for error reporting.
- The document root is `MindmapDocumentAst` with a single `.root: MindmapRootAstNode`.
- Branches hold `children: MindmapLeafAstNode[]` (direct child leaves). Each `MindmapLeafAstNode` also carries its own `children: MindmapLeafAstNode[]` for nested leaves — always recurse into leaf children when traversing the tree.

## Validation

- `parseMindmapDsl()` returns `{ ast: MindmapDocumentAst | null, warnings: ValidationWarning[], errors: ValidationError[] }`.
- Use the `MindmapValidationCode` union for all error/warning codes — do not introduce ad-hoc string literals.
- The parser uses recovery: a result may have both a non-null `ast` and non-empty `errors` (recovered structure). If the AST carries errors, still call `generateMindmapFromAst` and run layout — propagate the original errors into the top-level `generatedMindmapSchema.errors` array unchanged.
- On `"leaf-before-branch"`, the parser attaches the leaf to the most recently opened branch, or to the root if no branch has been opened yet, and adds `"recovered-structure"` to the document.

Key validation codes:
`"missing-root"`, `"duplicate-root"`, `"invalid-root-marker"`, `"branch-before-root"`, `"invalid-branch-marker"`, `"leaf-before-branch"`, `"invalid-branch-indentation"`, `"invalid-indentation"`, `"invalid-marker"`, `"missing-label"`, `"empty-line-skipped"`, `"recovered-structure"`

## Mindmap Schema (Zod-validated)

- Defined in `lib/mindmap/schema.ts`; always validate with `.strict()`.
- Top-level: `generatedMindmapSchema` with `version: "1.0"`, `metadata`, `nodes`, `edges`, `warnings`, `errors`.
- Each node carries: `id`, `kind`, `label`, `level`, `parentId`, `branchId`, `childIds`, `style` (colorToken, tintTone), `layout` (x, y, width, height).
- Node `id` is computed as `node-${path.join("-")}-${slug}` where `path` is the 1-based branch + position index array and `slug` lowercases the label and replaces non-alphanumeric characters with hyphens (diacritics stripped first). Branch IDs follow `branch-${branchIndex + 1}-${slug}`. Never assign arbitrary UUIDs.
- Colors are assigned per branch via the palette (`colorToken`, `tintTone`).

## AST → Schema Conversion

- Entry point: `generateMindmapFromAst(ast, options)` in `lib/mindmap/from-ast.ts`.
- Auto-grouping: when a branch has >6 direct children, the children are chunked into groups of 4 and each chunk is wrapped in a synthetic `GeneratedLeafInput` with a `"More: <firstLabel> - <lastLabel>"` label. This grouping happens in the schema/generation layer — the AST itself is not modified.
- Use the `antiCramLayoutDefaults` as the baseline for layout options — only override specific fields.

```typescript
const antiCramLayoutDefaults: MindmapLayoutDefaults = {
  canvasPadding: 96,
  levelGap: 168,
  siblingGap: 44,
  branchGap: 60,
  nodePaddingX: 20,
  nodePaddingY: 14,
  branchWidthHint: 220,
  branchHeightHint: 84,
  leafWidthHint: 156,
  leafHeightHint: 60,
};
```

## Layout & Rendering

- Layout is computed in a Web Worker (`workers/mindmap-layout.worker.ts`) using ELK.
- SVG preview utilities live in `lib/mindmap/svg-preview.ts`: `buildSvgPreviewModel()`, `wrapMindmapLabel()`, `createEdgePath()`, `panSvgPreviewTransform()`, `zoomSvgPreviewAroundPoint()`.
- Never run the ELK layout synchronously on the main thread.
