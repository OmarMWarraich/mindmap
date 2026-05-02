export type MindmapAstNodeKind = "root" | "branch" | "leaf";

export interface MindmapAstSource {
  line: number;
  column: number;
  indentLevel: number;
  raw: string;
}

export interface MindmapAstBaseNode {
  id: string;
  kind: MindmapAstNodeKind;
  label: string;
  source: MindmapAstSource;
}

export interface MindmapLeafAstNode extends MindmapAstBaseNode {
  kind: "leaf";
  children: MindmapLeafAstNode[];
}

export interface MindmapBranchAstNode extends MindmapAstBaseNode {
  kind: "branch";
  children: MindmapLeafAstNode[];
}

export interface MindmapRootAstNode extends MindmapAstBaseNode {
  kind: "root";
  branches: MindmapBranchAstNode[];
}

export type MindmapSubBranchAstNode = MindmapLeafAstNode;

export type MindmapAstNode =
  | MindmapRootAstNode
  | MindmapBranchAstNode
  | MindmapLeafAstNode;

export interface MindmapDocumentAst {
  root: MindmapRootAstNode;
}