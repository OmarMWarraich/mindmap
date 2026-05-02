import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';
import { layoutMindmapWithElk } from './layout.ts';

test('layoutMindmapWithElk returns positioned nodes and routed edges', async () => {
  const result = await layoutMindmapWithElk(validGeneratedMindmapFixture);

  assert.equal(result.nodes.length, validGeneratedMindmapFixture.nodes.length);
  assert.equal(result.edges.length, validGeneratedMindmapFixture.edges.length);
  assert.equal(result.width > 0, true);
  assert.equal(result.height > 0, true);
  assert.equal(result.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), true);
  assert.equal(result.edges.every((edge) => edge.points.length >= 2), true);
});