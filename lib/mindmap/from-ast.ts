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
import type { GeneratedMindmap, MindmapEdge, MindmapNode } from "./schema.ts";
import { validateGeneratedMindmap } from "./schema.ts";

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