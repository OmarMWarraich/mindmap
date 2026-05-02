import type {
  MindmapBranchAstNode,
  MindmapLeafAstNode,
  MindmapRootAstNode,
  MindmapAstSource,
} from "./ast.ts";
import {
  MINDMAP_DSL_BRANCH_PREFIX,
  MINDMAP_DSL_INDENT,
  MINDMAP_DSL_LEAF_PREFIX,
  MINDMAP_DSL_ROOT_PREFIX,
} from "./mvp.ts";
import type {
  MindmapValidationCode,
  MindmapValidationError,
  MindmapValidationResult,
  MindmapValidationWarning,
} from "./validation.ts";
import { createValidationTarget } from "./validation.ts";

interface LeafStackEntry {
  indentLevel: number;
  node: MindmapLeafAstNode;
}

export function parseMindmapDsl(input: string): MindmapValidationResult {
  const warnings: MindmapValidationWarning[] = [];
  const errors: MindmapValidationError[] = [];
  const lines = input.split(/\r?\n/);

  let root: MindmapRootAstNode | null = null;
  let currentBranch: MindmapBranchAstNode | null = null;
  const leafStack: LeafStackEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      warnings.push(
        createWarning("empty-line-skipped", "Blank lines are ignored.", createSource(raw, index, 0)),
      );
      continue;
    }

    const source = createSource(raw, index, countIndentLevel(raw));

    if (raw.includes("\t")) {
      errors.push(
        createError(
          "invalid-indentation",
          "Tabs are not allowed; use two spaces per indentation level.",
          source,
        ),
      );
      continue;
    }

    if (!hasValidIndentation(raw)) {
      errors.push(
        createError(
          "invalid-indentation",
          "Indentation must use spaces only and increase in steps of two spaces.",
          source,
        ),
      );
      continue;
    }

    if (hasInvalidRootMarker(trimmed)) {
      errors.push(
        createError(
          "invalid-root-marker",
          "Root lines must use the exact marker `@root: <label>` with no list prefix.",
          source,
        ),
      );
      continue;
    }

    if (hasInvalidBranchMarker(trimmed)) {
      errors.push(
        createError(
          "invalid-branch-marker",
          "Branch lines must use the exact marker `- @branch: <label>`.",
          source,
        ),
      );
      continue;
    }

    if (trimmed.startsWith("@root:")) {
      const nextRoot = handleRootLine(raw, source, errors, root !== null);

      if (nextRoot) {
        root = nextRoot;
        currentBranch = null;
        leafStack.length = 0;
      }

      continue;
    }

    if (trimmed.startsWith("- @branch:")) {
      if (root == null) {
        errors.push(
          createError(
            "branch-before-root",
            "Branches cannot appear before the root.",
            source,
          ),
        );
        continue;
      }

      const branch = handleBranchLine(raw, source, root, errors);

      if (branch == null) {
        continue;
      }

      root.branches.push(branch);
      currentBranch = branch;
      leafStack.length = 0;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const leaf = handleLeafLine(raw, source, root, currentBranch, leafStack, errors);

      if (!leaf) {
        continue;
      }

      attachLeafNode(leaf, currentBranch, leafStack, errors);
      continue;
    }

    errors.push(
      createError(
        "invalid-marker",
        "Line must be a root declaration, branch declaration, or leaf node.",
        source,
      ),
    );
  }

  if (!root) {
    errors.push(
      createError(
        "missing-root",
        "The first non-empty line must declare a root topic.",
        createSource("", 0, 0),
      ),
    );

    return { ast: null, warnings, errors };
  }

  return {
    ast: { root },
    warnings,
    errors,
  };
}

function handleRootLine(
  raw: string,
  source: MindmapAstSource,
  errors: MindmapValidationError[],
  hasExistingRoot: boolean,
): MindmapRootAstNode | null {
  if (source.indentLevel !== 0 || raw.trim() !== raw) {
    errors.push(
      createError(
        "invalid-indentation",
        "Root lines cannot be indented.",
        source,
      ),
    );
    return null;
  }

  if (hasExistingRoot) {
    errors.push(
      createError("duplicate-root", "Only one root declaration is allowed.", source),
    );
    return null;
  }

  const label = raw.slice(MINDMAP_DSL_ROOT_PREFIX.length).trim();

  if (label.length === 0) {
    errors.push(createError("missing-label", "Root labels cannot be empty.", source));
    return null;
  }

  return {
    id: createNodeId("root", label),
    kind: "root",
    label,
    source,
    branches: [],
  };
}

function handleBranchLine(
  raw: string,
  source: MindmapAstSource,
  root: MindmapRootAstNode,
  errors: MindmapValidationError[],
): MindmapBranchAstNode | null {
  if (source.indentLevel !== 0) {
    errors.push(
      createError(
        "invalid-branch-indentation",
        "Top-level branches cannot be indented.",
        source,
      ),
    );
    return null;
  }

  const label = raw.trim().slice(MINDMAP_DSL_BRANCH_PREFIX.length).trim();

  if (label.length === 0) {
    errors.push(createError("missing-label", "Branch labels cannot be empty.", source));
    return null;
  }

  return {
    id: createNodeId("branch", label),
    kind: "branch",
    label,
    source,
    children: [],
  };
}

function handleLeafLine(
  raw: string,
  source: MindmapAstSource,
  root: MindmapRootAstNode | null,
  branch: MindmapBranchAstNode | null,
  leafStack: LeafStackEntry[],
  errors: MindmapValidationError[],
): MindmapLeafAstNode | null {
  if (!root) {
    errors.push(
      createError("branch-before-root", "Leaf nodes cannot appear before the root.", source),
    );
    return null;
  }

  if (!branch) {
    errors.push(
      createError(
        "leaf-before-branch",
        "Leaf nodes cannot appear before the first branch.",
        source,
      ),
    );
    return null;
  }

  const label = raw.trim().slice(MINDMAP_DSL_LEAF_PREFIX.length).trim();

  if (label.length === 0) {
    errors.push(createError("missing-label", "Leaf labels cannot be empty.", source));
    return null;
  }

  if (!isValidLeafIndentation(source.indentLevel, leafStack)) {
    errors.push(
      createError(
        "invalid-indentation",
        "Leaf indentation must increase or decrease by one level at a time.",
        source,
      ),
    );
    return null;
  }

  return {
    id: createNodeId("leaf", label, source.line),
    kind: "leaf",
    label,
    source,
    children: [],
  };
}

function attachLeafNode(
  leaf: MindmapLeafAstNode,
  branch: MindmapBranchAstNode | null,
  leafStack: LeafStackEntry[],
  errors: MindmapValidationError[],
): void {
  if (!branch) {
    errors.push(
      createError(
        "leaf-before-branch",
        "Leaf nodes cannot appear before the first branch.",
        leaf.source,
      ),
    );
    return;
  }

  const parentLeaf = resolveLeafParent(leaf.source.indentLevel, leafStack);

  if (leaf.source.indentLevel > 1 && !parentLeaf) {
    errors.push(
      createError(
        "invalid-indentation",
        "Nested leaf nodes must have a parent exactly one indentation level above.",
        leaf.source,
      ),
    );
    return;
  }

  if (parentLeaf) {
    parentLeaf.children.push(leaf);
  } else {
    branch.children.push(leaf);
  }

  leafStack.push({ indentLevel: leaf.source.indentLevel, node: leaf });
}

function createWarning(
  code: MindmapValidationCode,
  message: string,
  source: MindmapAstSource,
): MindmapValidationWarning {
  return {
    severity: "warning",
    code,
    message,
    target: createValidationTarget(undefined, source),
  };
}

function createError(
  code: MindmapValidationCode,
  message: string,
  source: MindmapAstSource,
): MindmapValidationError {
  return {
    severity: "error",
    code,
    message,
    target: createValidationTarget(undefined, source),
  };
}

function createSource(raw: string, lineIndex: number, indentLevel: number): MindmapAstSource {
  const leadingSpaces = raw.match(/^ */)?.[0].length ?? 0;

  return {
    line: lineIndex + 1,
    column: leadingSpaces + 1,
    indentLevel,
    raw,
  };
}

function countIndentLevel(raw: string): number {
  const leadingSpaces = raw.match(/^ */)?.[0].length ?? 0;
  return leadingSpaces / MINDMAP_DSL_INDENT.length;
}

function hasValidIndentation(raw: string): boolean {
  const leadingSpaces = raw.match(/^ */)?.[0].length ?? 0;
  return leadingSpaces % MINDMAP_DSL_INDENT.length === 0;
}

function isValidLeafIndentation(indentLevel: number, leafStack: LeafStackEntry[]): boolean {
  if (indentLevel < 1) {
    return false;
  }

  if (leafStack.length === 0) {
    return indentLevel === 1;
  }

  const currentLevel = leafStack[leafStack.length - 1]?.indentLevel ?? 0;
  return indentLevel <= currentLevel + 1;
}

function resolveLeafParent(
  indentLevel: number,
  leafStack: LeafStackEntry[],
): MindmapLeafAstNode | null {
  while (
    leafStack.length > 0 &&
    leafStack[leafStack.length - 1]?.indentLevel >= indentLevel
  ) {
    leafStack.pop();
  }

  const parentEntry = leafStack[leafStack.length - 1];

  if (!parentEntry) {
    return null;
  }

  if (parentEntry.indentLevel !== indentLevel - 1) {
    return null;
  }

  return parentEntry.node;
}

function hasInvalidRootMarker(trimmed: string): boolean {
  if (trimmed.startsWith("- @root")) {
    return true;
  }

  return trimmed.startsWith("@root") && !trimmed.startsWith("@root:");
}

function hasInvalidBranchMarker(trimmed: string): boolean {
  if (trimmed.startsWith("@branch")) {
    return true;
  }

  return trimmed.startsWith("- @branch") && !trimmed.startsWith("- @branch:");
}

function createNodeId(kind: "root" | "branch" | "leaf", label: string, suffix?: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";

  return suffix ? `${kind}-${slug}-${suffix}` : `${kind}-${slug}`;
}