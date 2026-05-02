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
    branchOrder: ["branch-1-overview", "branch-2-calvin-cycle"],
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
      childIds: ["branch-1-overview", "branch-2-calvin-cycle"],
    },
    {
      id: "branch-1-overview",
      kind: "branch",
      label: "Overview",
      level: 1,
      parentId: "root-photosynthesis",
      branchId: "branch-1-overview",
      childIds: ["node-1-1-definition", "node-1-2-why-it-matters"],
      style: {
        branchKey: "branch-1-overview",
        branchIndex: 0,
        colorToken: "amber",
        tintTone: "strong",
      },
    },
    {
      id: "node-1-1-definition",
      kind: "leaf",
      label: "Definition",
      level: 2,
      parentId: "branch-1-overview",
      branchId: "branch-1-overview",
      childIds: [],
      style: {
        branchKey: "branch-1-overview",
        branchIndex: 0,
        colorToken: "amber",
        tintTone: "base",
      },
    },
    {
      id: "node-1-2-why-it-matters",
      kind: "leaf",
      label: "Why it matters",
      level: 2,
      parentId: "branch-1-overview",
      branchId: "branch-1-overview",
      childIds: [],
      style: {
        branchKey: "branch-1-overview",
        branchIndex: 0,
        colorToken: "amber",
        tintTone: "base",
      },
    },
    {
      id: "branch-2-calvin-cycle",
      kind: "branch",
      label: "Calvin cycle",
      level: 1,
      parentId: "root-photosynthesis",
      branchId: "branch-2-calvin-cycle",
      childIds: ["node-2-1-steps"],
      style: {
        branchKey: "branch-2-calvin-cycle",
        branchIndex: 1,
        colorToken: "emerald",
        tintTone: "strong",
      },
    },
    {
      id: "node-2-1-steps",
      kind: "leaf",
      label: "Steps",
      level: 2,
      parentId: "branch-2-calvin-cycle",
      branchId: "branch-2-calvin-cycle",
      childIds: ["node-2-1-1-fixation"],
      style: {
        branchKey: "branch-2-calvin-cycle",
        branchIndex: 1,
        colorToken: "emerald",
        tintTone: "base",
      },
    },
    {
      id: "node-2-1-1-fixation",
      kind: "leaf",
      label: "Fixation",
      level: 3,
      parentId: "node-2-1-steps",
      branchId: "branch-2-calvin-cycle",
      childIds: [],
      style: {
        branchKey: "branch-2-calvin-cycle",
        branchIndex: 1,
        colorToken: "emerald",
        tintTone: "soft",
      },
    },
  ],
  edges: [
    {
      id: "root-photosynthesis->branch-1-overview",
      from: "root-photosynthesis",
      to: "branch-1-overview",
    },
    {
      id: "branch-1-overview->node-1-1-definition",
      from: "branch-1-overview",
      to: "node-1-1-definition",
    },
    {
      id: "branch-1-overview->node-1-2-why-it-matters",
      from: "branch-1-overview",
      to: "node-1-2-why-it-matters",
    },
    {
      id: "root-photosynthesis->branch-2-calvin-cycle",
      from: "root-photosynthesis",
      to: "branch-2-calvin-cycle",
    },
    {
      id: "branch-2-calvin-cycle->node-2-1-steps",
      from: "branch-2-calvin-cycle",
      to: "node-2-1-steps",
    },
    {
      id: "node-2-1-steps->node-2-1-1-fixation",
      from: "node-2-1-steps",
      to: "node-2-1-1-fixation",
    },
  ],
  warnings: [],
  errors: [],
};

export const malformedGeneratedMindmapFixture: unknown = {
  ...validGeneratedMindmapFixture,
  nodes: validGeneratedMindmapFixture.nodes.map((node) =>
    node.id === "branch-1-overview"
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