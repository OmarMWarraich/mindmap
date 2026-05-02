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
} from "./palette";
import type { GeneratedMindmap, MindmapEdge, MindmapNode } from "./schema.ts";
import { validateGeneratedMindmap } from "./schema";

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
  const branchOrder = ast.root.branches.map((branch) => branch.id);

  nodes.push({
    id: ast.root.id,
    kind: "root",
    label: ast.root.label,
    level: 0,
    parentId: null,
    branchId: ast.root.id,
    childIds: branchOrder,
  });

  ast.root.branches.forEach((branch, branchIndex) => {
    appendBranch(branch, ast.root.id, branchIndex, nodes, edges);
  });

  return validateGeneratedMindmap({
    version: "1.0",
    metadata: {
      title: ast.root.label,
      rootId: ast.root.id,
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
  const colorToken = getMindmapBranchColorToken(branchIndex);

  nodes.push({
    id: branch.id,
    kind: "branch",
    label: branch.label,
    level: 1,
    parentId: rootId,
    branchId: branch.id,
    childIds: branch.children.map((child) => child.id),
    style: {
      branchKey: branch.id,
      branchIndex,
      colorToken,
      tintTone: getMindmapTintTone(1),
    },
  });

  edges.push({
    id: createEdgeId(rootId, branch.id),
    from: rootId,
    to: branch.id,
  });

  branch.children.forEach((child) => {
    appendLeaf(child, branch.id, branch.id, branchIndex, 2, nodes, edges);
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
): void {
  nodes.push({
    id: leaf.id,
    kind: "leaf",
    label: leaf.label,
    level,
    parentId,
    branchId,
    childIds: leaf.children.map((child) => child.id),
    style: {
      branchKey: branchId,
      branchIndex,
      colorToken: getMindmapBranchColorToken(branchIndex),
      tintTone: getMindmapTintTone(level),
    },
  });

  edges.push({
    id: createEdgeId(parentId, leaf.id),
    from: parentId,
    to: leaf.id,
  });

  leaf.children.forEach((child) => {
    appendLeaf(child, leaf.id, branchId, branchIndex, level + 1, nodes, edges);
  });
}

function createEdgeId(from: string, to: string): string {
  return `${from}->${to}`;
}