import type {
  MindmapBranchAstNode,
  MindmapDocumentAst,
  MindmapLeafAstNode,
} from "../dsl/ast.ts";
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
  const colorToken = getMindmapBranchColorToken(branchIndex);

  nodes.push({
    id: branchId,
    kind: "branch",
    label: branchLabel,
    level: 1,
    parentId: rootId,
    branchId: branchId,
    childIds: branch.children.map((child, childIndex) =>
      createNodeId([branchIndex + 1, childIndex + 1], normalizeMindmapLabel(child.label)),
    ),
    layout: createNodeLayout("branch", branchLabel, branch.children.length, 1),
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

  branch.children.forEach((child, childIndex) => {
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
  leaf: MindmapLeafAstNode,
  parentId: string,
  branchId: string,
  branchIndex: number,
  level: number,
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  path: number[],
): void {
  const label = normalizeMindmapLabel(leaf.label);
  const nodeId = createNodeId(path, label);

  nodes.push({
    id: nodeId,
    kind: "leaf",
    label,
    level,
    parentId,
    branchId,
    childIds: leaf.children.map((child, childIndex) =>
      createNodeId([...path, childIndex + 1], normalizeMindmapLabel(child.label)),
    ),
    layout: createNodeLayout("leaf", label, leaf.children.length, level),
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
  return label.replace(/\s+/g, " ").trim();
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
  const baseWidth =
    kind === "branch"
      ? antiCramLayoutDefaults.branchWidthHint
      : kind === "leaf"
        ? antiCramLayoutDefaults.leafWidthHint
        : antiCramLayoutDefaults.branchWidthHint + 28;
  const baseHeight =
    kind === "branch"
      ? antiCramLayoutDefaults.branchHeightHint
      : kind === "leaf"
        ? antiCramLayoutDefaults.leafHeightHint
        : antiCramLayoutDefaults.branchHeightHint + 12;
  const widthFromLabel = Math.max(0, Math.min(label.length, 40) - 12) * 5;
  const heightFromChildren = Math.min(childCount, 5) * 10;
  const levelTaper = Math.max(0, level - 2) * 4;

  return {
    minWidth: baseWidth + widthFromLabel,
    minHeight: baseHeight + heightFromChildren,
    paddingX: antiCramLayoutDefaults.nodePaddingX,
    paddingY: antiCramLayoutDefaults.nodePaddingY,
    siblingGap: antiCramLayoutDefaults.siblingGap + Math.min(childCount, 4) * 4 + levelTaper,
  };
}