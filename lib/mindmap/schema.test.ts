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
    "branch-overview",
    "branch-calvin-cycle",
  ]);
  assert.deepEqual(
    generated.edges.map((edge) => edge.id),
    validGeneratedMindmapFixture.edges.map((edge) => edge.id),
  );
  assert.equal(
    generated.nodes.find((node) => node.id === "branch-overview")?.style?.colorToken,
    "amber",
  );
  assert.equal(
    generated.nodes.find((node) => node.id === "leaf-fixation")?.style?.tintTone,
    "soft",
  );
});