import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';
import type { MindmapLayoutResult } from './layout.ts';
import {
  applyMindmapNodePositionOverrides,
  pruneMindmapNodePositionOverrides,
} from './node-overrides.ts';

function createLayoutFixture(): MindmapLayoutResult {
  return {
    width: 900,
    height: 700,
    nodes: validGeneratedMindmapFixture.nodes.map((node, index) => ({
      id: node.id,
      x: index * 100,
      y: index * 50,
      width: 100,
      height: 40,
    })),
    edges: validGeneratedMindmapFixture.edges.map((edge) => ({
      id: edge.id,
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    })),
  };
}

function nodeById(result: MindmapLayoutResult, id: string) {
  return result.nodes.find((node) => node.id === id);
}

test('dragging a branch moves the branch and its whole subtree', () => {
  const result = applyMindmapNodePositionOverrides(
    validGeneratedMindmapFixture,
    createLayoutFixture(),
    { 'branch-1-overview': { dx: 40, dy: -20 } },
  );

  assert.deepEqual(nodeById(result, 'branch-1-overview'), {
    id: 'branch-1-overview', x: 140, y: 30, width: 100, height: 40,
  });
  assert.equal(nodeById(result, 'node-1-1-definition')?.x, 240);
  assert.equal(nodeById(result, 'node-1-1-definition')?.y, 80);
  assert.equal(nodeById(result, 'node-1-2-why-it-matters')?.x, 340);
  assert.equal(nodeById(result, 'root-photosynthesis')?.x, 0);
  assert.equal(nodeById(result, 'branch-2-calvin-cycle')?.x, 400);
});

test('a child override composes with its ancestor override', () => {
  const result = applyMindmapNodePositionOverrides(
    validGeneratedMindmapFixture,
    createLayoutFixture(),
    {
      'branch-1-overview': { dx: 10, dy: 0 },
      'node-1-1-definition': { dx: 5, dy: 5 },
    },
  );

  assert.equal(nodeById(result, 'node-1-1-definition')?.x, 215);
  assert.equal(nodeById(result, 'node-1-1-definition')?.y, 105);
});

test('edges inside a moved subtree translate their routed points', () => {
  const result = applyMindmapNodePositionOverrides(
    validGeneratedMindmapFixture,
    createLayoutFixture(),
    { 'branch-1-overview': { dx: 40, dy: -20 } },
  );
  const edge = result.edges.find(
    (candidate) => candidate.id === 'branch-1-overview->node-1-1-definition',
  );

  assert.deepEqual(edge?.points, [
    { x: 41, y: -18 },
    { x: 43, y: -16 },
  ]);
});

test('edges crossing a subtree boundary re-route center-to-center', () => {
  const result = applyMindmapNodePositionOverrides(
    validGeneratedMindmapFixture,
    createLayoutFixture(),
    { 'branch-1-overview': { dx: 40, dy: -20 } },
  );
  const edge = result.edges.find(
    (candidate) => candidate.id === 'root-photosynthesis->branch-1-overview',
  );

  assert.deepEqual(edge?.points, [
    { x: 50, y: 20 },
    { x: 190, y: 50 },
  ]);
});

test('stationary nodes and edges are returned unchanged', () => {
  const layout = createLayoutFixture();
  const result = applyMindmapNodePositionOverrides(
    validGeneratedMindmapFixture,
    layout,
    { 'branch-2-calvin-cycle': { dx: 12, dy: 12 } },
  );

  assert.equal(nodeById(result, 'root-photosynthesis'), layout.nodes[0]);
  assert.equal(
    result.edges.find((edge) => edge.id === 'branch-1-overview->node-1-1-definition'),
    layout.edges.find((edge) => edge.id === 'branch-1-overview->node-1-1-definition'),
  );
});

test('scale options scale the stored offsets for export parity', () => {
  const result = applyMindmapNodePositionOverrides(
    validGeneratedMindmapFixture,
    createLayoutFixture(),
    { 'branch-1-overview': { dx: 40, dy: -20 } },
    { scaleX: 2, scaleY: 0.5 },
  );

  assert.equal(nodeById(result, 'branch-1-overview')?.x, 180);
  assert.equal(nodeById(result, 'branch-1-overview')?.y, 40);
});

test('canvas bounds grow to include nodes dragged past the edge', () => {
  const result = applyMindmapNodePositionOverrides(
    validGeneratedMindmapFixture,
    createLayoutFixture(),
    { 'node-2-1-1-fixation': { dx: 400, dy: 400 } },
  );

  assert.equal(result.width, 1100);
  assert.equal(result.height, 740);
});

test('empty overrides return the layout untouched', () => {
  const layout = createLayoutFixture();

  assert.equal(
    applyMindmapNodePositionOverrides(validGeneratedMindmapFixture, layout, {}),
    layout,
  );
});

test('prune drops unknown node ids and zero offsets', () => {
  assert.deepEqual(
    pruneMindmapNodePositionOverrides(
      {
        'branch-1-overview': { dx: 4, dy: 4 },
        'node-gone-missing': { dx: 9, dy: 9 },
        'node-2-1-steps': { dx: 0, dy: 0 },
      },
      validGeneratedMindmapFixture,
    ),
    { 'branch-1-overview': { dx: 4, dy: 4 } },
  );
});

test('prune keeps overrides untouched when no mindmap is available', () => {
  const overrides = { 'branch-1-overview': { dx: 4, dy: 4 } };

  assert.equal(pruneMindmapNodePositionOverrides(overrides, null), overrides);
});
