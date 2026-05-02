import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';
import {
  createMindmapRadialLayoutOptions,
  layoutMindmapWithElk,
} from './layout.ts';

test('createMindmapRadialLayoutOptions maps generation spacing hints to ELK radial options', () => {
  assert.deepEqual(createMindmapRadialLayoutOptions(validGeneratedMindmapFixture), {
    'elk.algorithm': 'radial',
    'org.eclipse.elk.radial.centerOnRoot': 'true',
    'org.eclipse.elk.radial.compactor': 'NONE',
    'org.eclipse.elk.radial.wedgeCriteria': 'NODE_SIZE',
    'org.eclipse.elk.radial.radius': '168',
    'org.eclipse.elk.spacing.nodeNode': '44',
    'org.eclipse.elk.padding': '[top=96,left=96,bottom=96,right=96]',
  });
});

test('layoutMindmapWithElk returns positioned nodes and routed edges', async () => {
  const result = await layoutMindmapWithElk(validGeneratedMindmapFixture);

  assert.equal(result.nodes.length, validGeneratedMindmapFixture.nodes.length);
  assert.equal(result.edges.length, validGeneratedMindmapFixture.edges.length);
  assert.equal(result.width > 0, true);
  assert.equal(result.height > 0, true);
  assert.equal(result.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), true);
  assert.equal(result.edges.every((edge) => edge.points.length >= 2), true);
});