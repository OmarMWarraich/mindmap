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
});

test("generatedMindmapSchema rejects malformed fixture payloads", () => {
  const result = generatedMindmapSchema.safeParse(malformedGeneratedMindmapFixture);

  assert.equal(result.success, false);

  if (result.success) {
    return;
  }

  assert(
    result.error.issues.some((issue) => issue.path.join(".").includes("colorToken")),
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