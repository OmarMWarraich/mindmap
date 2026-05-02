import type { MindmapDocumentAst } from "../../dsl/ast.ts";
import type { GeneratedMindmap } from "../schema.ts";

export const mindmapAstFixture: MindmapDocumentAst = {
  root: {
    id: "root-photosynthesis",
    kind: "root",
    label: "Photosynthesis",
    source: {
      line: 1,
      column: 1,
      indentLevel: 0,
      raw: "@root: Photosynthesis",
    },
    branches: [
      {
        id: "branch-overview",
        kind: "branch",
        label: "Overview",
        source: {
          line: 2,
          column: 1,
          indentLevel: 0,
          raw: "- @branch: Overview",
        },
        children: [
          {
            id: "leaf-definition",
            kind: "leaf",
            label: "Definition",
            source: {
              line: 3,
              column: 3,
              indentLevel: 1,
              raw: "  - Definition",
            },
            children: [],
          },
          {
            id: "leaf-importance",
            kind: "leaf",
            label: "Why it matters",
            source: {
              line: 4,
              column: 3,
              indentLevel: 1,
              raw: "  - Why it matters",
            },
            children: [],
          },
        ],
      },
      {
        id: "branch-calvin-cycle",
        kind: "branch",
        label: "Calvin cycle",
        source: {
          line: 5,
          column: 1,
          indentLevel: 0,
          raw: "- @branch: Calvin cycle",
        },
        children: [
          {
            id: "leaf-steps",
            kind: "leaf",
            label: "Steps",
            source: {
              line: 6,
              column: 3,
              indentLevel: 1,
              raw: "  - Steps",
            },
            children: [
              {
                id: "leaf-fixation",
                kind: "leaf",
                label: "Fixation",
                source: {
                  line: 7,
                  column: 5,
                  indentLevel: 2,
                  raw: "    - Fixation",
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const validGeneratedMindmapFixture: GeneratedMindmap = {
  version: "1.0",
  metadata: {
    title: "Photosynthesis",
    rootId: "root-photosynthesis",
    branchOrder: ["branch-overview", "branch-calvin-cycle"],
    source: {
      format: "mindmap-dsl",
      version: "mvp-v1",
    },
  },
  nodes: [
    {
      id: "root-photosynthesis",
      kind: "root",
      label: "Photosynthesis",
      level: 0,
      parentId: null,
      branchId: "root-photosynthesis",
      childIds: ["branch-overview", "branch-calvin-cycle"],
    },
    {
      id: "branch-overview",
      kind: "branch",
      label: "Overview",
      level: 1,
      parentId: "root-photosynthesis",
      branchId: "branch-overview",
      childIds: ["leaf-definition", "leaf-importance"],
      style: {
        branchKey: "branch-overview",
        branchIndex: 0,
        colorToken: "amber",
        tintTone: "strong",
      },
    },
    {
      id: "leaf-definition",
      kind: "leaf",
      label: "Definition",
      level: 2,
      parentId: "branch-overview",
      branchId: "branch-overview",
      childIds: [],
      style: {
        branchKey: "branch-overview",
        branchIndex: 0,
        colorToken: "amber",
        tintTone: "base",
      },
    },
    {
      id: "leaf-importance",
      kind: "leaf",
      label: "Why it matters",
      level: 2,
      parentId: "branch-overview",
      branchId: "branch-overview",
      childIds: [],
      style: {
        branchKey: "branch-overview",
        branchIndex: 0,
        colorToken: "amber",
        tintTone: "base",
      },
    },
    {
      id: "branch-calvin-cycle",
      kind: "branch",
      label: "Calvin cycle",
      level: 1,
      parentId: "root-photosynthesis",
      branchId: "branch-calvin-cycle",
      childIds: ["leaf-steps"],
      style: {
        branchKey: "branch-calvin-cycle",
        branchIndex: 1,
        colorToken: "emerald",
        tintTone: "strong",
      },
    },
    {
      id: "leaf-steps",
      kind: "leaf",
      label: "Steps",
      level: 2,
      parentId: "branch-calvin-cycle",
      branchId: "branch-calvin-cycle",
      childIds: ["leaf-fixation"],
      style: {
        branchKey: "branch-calvin-cycle",
        branchIndex: 1,
        colorToken: "emerald",
        tintTone: "base",
      },
    },
    {
      id: "leaf-fixation",
      kind: "leaf",
      label: "Fixation",
      level: 3,
      parentId: "leaf-steps",
      branchId: "branch-calvin-cycle",
      childIds: [],
      style: {
        branchKey: "branch-calvin-cycle",
        branchIndex: 1,
        colorToken: "emerald",
        tintTone: "soft",
      },
    },
  ],
  edges: [
    {
      id: "root-photosynthesis->branch-overview",
      from: "root-photosynthesis",
      to: "branch-overview",
    },
    {
      id: "branch-overview->leaf-definition",
      from: "branch-overview",
      to: "leaf-definition",
    },
    {
      id: "branch-overview->leaf-importance",
      from: "branch-overview",
      to: "leaf-importance",
    },
    {
      id: "root-photosynthesis->branch-calvin-cycle",
      from: "root-photosynthesis",
      to: "branch-calvin-cycle",
    },
    {
      id: "branch-calvin-cycle->leaf-steps",
      from: "branch-calvin-cycle",
      to: "leaf-steps",
    },
    {
      id: "leaf-steps->leaf-fixation",
      from: "leaf-steps",
      to: "leaf-fixation",
    },
  ],
  warnings: [],
  errors: [],
};

export const malformedGeneratedMindmapFixture: unknown = {
  ...validGeneratedMindmapFixture,
  nodes: validGeneratedMindmapFixture.nodes.map((node) =>
    node.id === "branch-overview"
      ? {
          ...node,
          style: {
            ...node.style,
            colorToken: "banana",
          },
        }
      : node,
  ),
};