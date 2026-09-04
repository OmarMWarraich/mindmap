import type {
  MindmapBranchAstNode,
  MindmapDocumentAst,
  MindmapLeafAstNode,
} from "../dsl/ast.ts";
import {
  stripMindmapInlineFormatting,
} from "../dsl/inline-formatting.ts";
import type {
  MindmapValidationError,
  MindmapValidationWarning,
} from "../dsl/validation.ts";
import {
  getMindmapBranchColorToken,
  getMindmapTintTone,
} from "./palette.ts";
import type {
  GeneratedMindmap,
  MindmapEdge,
  MindmapLayoutDefaults,
  MindmapNode,
  MindmapNodeKind,
} from "./schema.ts";
import { validateGeneratedMindmap } from "./schema.ts";

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

const maxDirectBranchChildrenBeforeGrouping = 6;
const overflowGroupChunkSize = 4;
const estimatedCharWidthPx = 8;
const estimatedLineHeightPx = 20;

interface GeneratedLeafInput {
  label: string;
  children: GeneratedLeafInput[];
}

export interface GenerateMindmapFromAstOptions {
  warnings?: MindmapValidationWarning[];
  errors?: MindmapValidationError[];
  generatedAt?: string;
}

export function generateMindmapFromAst(
  ast: MindmapDocumentAst,
  options: GenerateMindmapFromAstOptions = {},
): GeneratedMindmap {
  const nodes: MindmapNode[] = [];
  const edges: MindmapEdge[] = [];
  const rootLabel = normalizeMindmapLabel(ast.root.label);
  const rootId = createRootId(rootLabel);
  const branchOrder = ast.root.branches.map((branch, branchIndex) =>
    createBranchId(branchIndex, normalizeMindmapLabel(branch.label)),
  );

  nodes.push({
    id: rootId,
    kind: "root",
    label: rootLabel,
    level: 0,
    parentId: null,
    branchId: rootId,
    childIds: branchOrder,
    layout: createNodeLayout("root", rootLabel, branchOrder.length, 0),
  });

  ast.root.branches.forEach((branch, branchIndex) => {
    appendBranch(branch, rootId, branchIndex, nodes, edges);
  });

  return validateGeneratedMindmap({
    version: "1.0",
    metadata: {
      title: ast.root.label,
      rootId,
      branchOrder,
      layout: antiCramLayoutDefaults,
      ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
      source: {
        format: "mindmap-dsl",
        version: "mvp-v1",
      },
    },
    nodes,
    edges,
    warnings: options.warnings ?? [],
    errors: options.errors ?? [],
  });
}

function appendBranch(
  branch: MindmapBranchAstNode,
  rootId: string,
  branchIndex: number,
  nodes: MindmapNode[],
  edges: MindmapEdge[],
): void {
  const branchLabel = normalizeMindmapLabel(branch.label);
  const branchId = createBranchId(branchIndex, branchLabel);
  const branchChildren = getBranchChildrenForGeneration(branch);
  const colorToken = getMindmapBranchColorToken(branchIndex);

  nodes.push({
    id: branchId,
    kind: "branch",
    label: branchLabel,
    level: 1,
    parentId: rootId,
    branchId: branchId,
    childIds: branchChildren.map((child, childIndex) =>
      createNodeId([branchIndex + 1, childIndex + 1], child.label),
    ),
    layout: createNodeLayout("branch", branchLabel, branchChildren.length, 1),
    style: {
      branchKey: branchId,
      branchIndex,
      colorToken,
      tintTone: getMindmapTintTone(1),
    },
  });

  edges.push({
    id: createEdgeId(rootId, branchId),
    from: rootId,
    to: branchId,
  });

  branchChildren.forEach((child, childIndex) => {
    appendLeaf(
      child,
      branchId,
      branchId,
      branchIndex,
      2,
      nodes,
      edges,
      [branchIndex + 1, childIndex + 1],
    );
  });
}

function appendLeaf(
  leaf: GeneratedLeafInput,
  parentId: string,
  branchId: string,
  branchIndex: number,
  level: number,
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  path: number[],
): void {
  const nodeId = createNodeId(path, leaf.label);

  nodes.push({
    id: nodeId,
    kind: "leaf",
    label: leaf.label,
    level,
    parentId,
    branchId,
    childIds: leaf.children.map((child, childIndex) =>
      createNodeId([...path, childIndex + 1], child.label),
    ),
    layout: createNodeLayout("leaf", leaf.label, leaf.children.length, level),
    style: {
      branchKey: branchId,
      branchIndex,
      colorToken: getMindmapBranchColorToken(branchIndex),
      tintTone: getMindmapTintTone(level),
    },
  });

  edges.push({
    id: createEdgeId(parentId, nodeId),
    from: parentId,
    to: nodeId,
  });

  leaf.children.forEach((child, childIndex) => {
    appendLeaf(
      child,
      nodeId,
      branchId,
      branchIndex,
      level + 1,
      nodes,
      edges,
      [...path, childIndex + 1],
    );
  });
}

function createRootId(label: string): string {
  return `root-${createStableSlug(label) || "topic"}`;
}

function createBranchId(branchIndex: number, label: string): string {
  return `branch-${branchIndex + 1}-${createStableSlug(label) || "section"}`;
}

function createNodeId(path: number[], label: string): string {
  return `node-${path.join("-")}-${createStableSlug(label) || "item"}`;
}

function createEdgeId(from: string, to: string): string {
  return `${from}->${to}`;
}

function normalizeMindmapLabel(label: string): string {
  return label
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*([,:;])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function createStableSlug(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createNodeLayout(
  kind: MindmapNodeKind,
  label: string,
  childCount: number,
  level: number,
): MindmapNode["layout"] {
  const paddingX = antiCramLayoutDefaults.nodePaddingX;
  const paddingY = antiCramLayoutDefaults.nodePaddingY;
  const baseWidth =
    kind === "branch"
      ? antiCramLayoutDefaults.branchWidthHint
      : kind === "leaf"
        ? antiCramLayoutDefaults.leafWidthHint
        : antiCramLayoutDefaults.branchWidthHint + 48;
  const baseHeight =
    kind === "branch"
      ? antiCramLayoutDefaults.branchHeightHint
      : kind === "leaf"
        ? antiCramLayoutDefaults.leafHeightHint
        : antiCramLayoutDefaults.branchHeightHint + 18;

  // Use a wider wrap target for root nodes and tighter wrapping for branches
  // and leaves so text remains readable without making the boxes too large.
  const targetCharsPerLine =
    kind === 'root' ? 48 : kind === 'branch' ? 24 : 22;
  // Size boxes from the visible text so formatting markers don't inflate nodes.
  const wrappedLines = wrapLabelForLayout(stripMindmapInlineFormatting(label), targetCharsPerLine);
  const longestLineLength = wrappedLines.reduce(
    (longest, line) => Math.max(longest, line.length),
    0,
  );
  const contentWidth = paddingX * 2 + Math.max(longestLineLength, 8) * estimatedCharWidthPx;
  const labelBottom = (kind === 'root' ? 50 : 42) + wrappedLines.length * estimatedLineHeightPx + paddingY;
  const heightFromChildren = Math.min(childCount, 5) * 10;
  const levelTaper = Math.max(0, level - 2) * 4;

  return {
    minWidth: Math.max(baseWidth, contentWidth),
    minHeight: Math.max(baseHeight + heightFromChildren, labelBottom),
    paddingX,
    paddingY,
    siblingGap: antiCramLayoutDefaults.siblingGap + Math.min(childCount, 4) * 4 + levelTaper,
  };
}

function wrapLabelForLayout(label: string, maxCharsPerLine: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    const nextLine = `${currentLine} ${word}`;

    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  lines.push(currentLine);
  return lines;
}

function getBranchChildrenForGeneration(
  branch: MindmapBranchAstNode,
): GeneratedLeafInput[] {
  const directChildren = branch.children.map((child) => createGeneratedLeafInput(child));

  if (directChildren.length <= maxDirectBranchChildrenBeforeGrouping) {
    return directChildren;
  }

  const groupedChildren: GeneratedLeafInput[] = [];

  for (let index = 0; index < directChildren.length; index += overflowGroupChunkSize) {
    const chunk = directChildren.slice(index, index + overflowGroupChunkSize);
    groupedChildren.push({
      label: createOverflowGroupLabel(chunk),
      children: chunk,
    });
  }

  return groupedChildren;
}

function createGeneratedLeafInput(leaf: MindmapLeafAstNode): GeneratedLeafInput {
  return {
    label: normalizeMindmapLabel(leaf.label),
    children: leaf.children.map((child) => createGeneratedLeafInput(child)),
  };
}

function createOverflowGroupLabel(children: GeneratedLeafInput[]): string {
  const firstLabel = children[0]?.label ?? "extra topics";
  const lastLabel = children.at(-1)?.label ?? firstLabel;

  if (firstLabel === lastLabel) {
    return normalizeMindmapLabel(`More: ${firstLabel}`);
  }

  return normalizeMindmapLabel(`More: ${firstLabel} - ${lastLabel}`);
}