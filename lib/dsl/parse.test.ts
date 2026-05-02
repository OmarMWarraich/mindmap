import assert from "node:assert/strict";
import test from "node:test";

import {
  invalidHierarchyMindmapDslFixture,
  invalidIndentationMindmapDslFixture,
  malformedMarkerMindmapDslFixture,
  malformedMindmapDslFixture,
  validMindmapDslFixture,
} from "./__fixtures__/parser.ts";
import { parseMindmapDsl } from "./parse.ts";

test("parseMindmapDsl converts valid DSL into a document AST", () => {
  const result = parseMindmapDsl(validMindmapDslFixture);

  assert.equal(result.errors.length, 0);
  assert.ok(result.ast);
  assert.equal(result.ast?.root.label, "Photosynthesis");
  assert.equal(result.ast?.root.branches.length, 3);
  assert.equal(result.ast?.root.branches[2]?.children[1]?.label, "Steps");
  assert.equal(
    result.ast?.root.branches[2]?.children[1]?.children[2]?.label,
    "Regeneration",
  );
});

test("parseMindmapDsl reports malformed structure with stable validation codes", () => {
  const result = parseMindmapDsl(malformedMindmapDslFixture);

  assert.ok(result.ast);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    [
      "branch-before-root",
      "invalid-marker",
      "missing-label",
      "invalid-indentation",
    ],
  );
});

test("parseMindmapDsl validates malformed root and branch markers explicitly", () => {
  const result = parseMindmapDsl(malformedMarkerMindmapDslFixture);

  assert.equal(result.ast, null);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    [
      "invalid-root-marker",
      "invalid-branch-marker",
      "invalid-root-marker",
      "invalid-branch-marker",
      "missing-root",
    ],
  );
});

test("parseMindmapDsl rejects invalid indentation width and skipped indentation levels", () => {
  const result = parseMindmapDsl(invalidIndentationMindmapDslFixture);

  assert.ok(result.ast);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["invalid-indentation", "invalid-indentation"],
  );
});

test("parseMindmapDsl rejects hierarchy without an exact parent level", () => {
  const result = parseMindmapDsl(invalidHierarchyMindmapDslFixture);

  assert.ok(result.ast);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["invalid-indentation"],
  );
});