import assert from "node:assert/strict";
import test from "node:test";

import {
  malformedGeneratedMindmapFixture,
  mindmapAstFixture,
  validGeneratedMindmapFixture,
} from "./__fixtures__/generatedMindmap.ts";
import { generateMindmapFromAst } from "./from-ast.ts";
import { generatedMindmapSchema, validateGeneratedMindmap } from "./schema.ts";

test("validateGeneratedMindmap accepts the valid fixture", () => {
  const parsed = validateGeneratedMindmap(validGeneratedMindmapFixture);

  assert.equal(parsed.metadata.title, "Photosynthesis");
  assert.equal(parsed.nodes.length, 7);
  assert.equal(parsed.metadata.layout.levelGap, 168);
});

test("generatedMindmapSchema rejects malformed fixture payloads", () => {
  const result = generatedMindmapSchema.safeParse(malformedGeneratedMindmapFixture);

  assert.equal(result.success, false);

  if (result.success) {
    return;
  }

  assert(
    result.error.issues.some(
      (issue) =>
        issue.path.join(".").includes("colorToken") ||
        issue.path.join(".").includes("branchGap"),
    ),
  );
});

test("generateMindmapFromAst emits schema-valid nodes, edges, and palette styles", () => {
  const generated = generateMindmapFromAst(mindmapAstFixture);

  assert.deepEqual(generated.metadata.branchOrder, [
    "branch-1-overview",
    "branch-2-calvin-cycle",
  ]);
  assert.deepEqual(
    generated.edges.map((edge) => edge.id),
    validGeneratedMindmapFixture.edges.map((edge) => edge.id),
  );
  assert.equal(
    generated.nodes.find((node) => node.id === "branch-1-overview")?.style?.colorToken,
    "amber",
  );
  assert.equal(
    generated.nodes.find((node) => node.id === "node-2-1-1-fixation")?.style?.tintTone,
    "soft",
  );
  assert.equal(generated.metadata.layout.canvasPadding, 96);
  assert.equal(
    generated.nodes.find((node) => node.id === "branch-1-overview")?.layout.minHeight,
    104,
  );
});

test("generateMindmapFromAst assigns deterministic graph ids even when AST ids collide", () => {
  const generated = generateMindmapFromAst({
    root: {
      ...mindmapAstFixture.root,
      id: "root-duplicate",
      branches: mindmapAstFixture.root.branches.map((branch) => ({
        ...branch,
        id: "branch-duplicate",
        children: branch.children.map((child) => ({
          ...child,
          id: "leaf-duplicate",
          children: child.children.map((grandchild) => ({
            ...grandchild,
            id: "leaf-duplicate",
          })),
        })),
      })),
    },
  });

  assert.equal(generated.metadata.rootId, "root-photosynthesis");
  assert.deepEqual(generated.metadata.branchOrder, [
    "branch-1-overview",
    "branch-2-calvin-cycle",
  ]);
  assert.equal(new Set(generated.nodes.map((node) => node.id)).size, generated.nodes.length);
  assert.equal(generated.edges.every((edge) => edge.id.includes("->")), true);
});

test("generateMindmapFromAst cleans labels and groups overloaded branches", () => {
  const generated = generateMindmapFromAst({
    root: {
      id: "root-messy",
      kind: "root",
      label: "  Cellular   respiration  ",
      source: {
        line: 1,
        column: 1,
        indentLevel: 0,
        raw: "@root: Cellular respiration",
      },
      branches: [
        {
          id: "branch-messy",
          kind: "branch",
          label: "  Electron   transport   chain  ",
          source: {
            line: 2,
            column: 1,
            indentLevel: 0,
            raw: "- @branch: Electron transport chain",
          },
          children: [
            "  NADH   oxidation  ",
            " Proton   pumping across inner membrane ",
            " ATP synthase rotor coupling ",
            " Chemiosmosis link to ATP output ",
            " Oxygen as terminal electron acceptor ",
            " Reactive oxygen species control ",
            " Extremely verbose label describing regulation of mitochondrial electron transport efficiency under stress conditions ",
          ].map((label, index) => ({
            id: `leaf-${index + 1}`,
            kind: "leaf" as const,
            label,
            source: {
              line: index + 3,
              column: 3,
              indentLevel: 1,
              raw: `  - ${label.trim()}`,
            },
            children: [],
          })),
        },
      ],
    },
  });

  const branchNode = generated.nodes.find((node) => node.id === "branch-1-electron-transport-chain");

  assert.equal(generated.metadata.title, "Cellular   respiration");
  assert.equal(generated.metadata.rootId, "root-cellular-respiration");
  assert.equal(branchNode?.childIds.length, 2);

  const groupedChildren = generated.nodes.filter(
    (node) => node.parentId === "branch-1-electron-transport-chain",
  );

  assert.equal(groupedChildren.length, 2);
  assert.equal(groupedChildren.every((node) => node.label.startsWith("More:")), true);
  assert.equal(
    generated.nodes.some((node) => node.label.endsWith("...")),
    true,
  );
});