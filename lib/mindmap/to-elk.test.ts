import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validGeneratedMindmapFixture,
} from './__fixtures__/generatedMindmap.ts';
import { translateMindmapToElkGraph } from './to-elk.ts';

test('translateMindmapToElkGraph maps the generated mindmap into ELK nodes and edges', () => {
  const graph = translateMindmapToElkGraph(validGeneratedMindmapFixture);

  assert.equal(graph.id, validGeneratedMindmapFixture.metadata.rootId);
  assert.equal(graph.children?.length, validGeneratedMindmapFixture.nodes.length);
  assert.equal(graph.edges?.length, validGeneratedMindmapFixture.edges.length);

  const rootNode = graph.children?.find((child) => child.id === 'root-photosynthesis');
  const branchNode = graph.children?.find((child) => child.id === 'branch-1-overview');

  assert.deepEqual(rootNode, {
    id: 'root-photosynthesis',
    width: 288,
    height: 124,
  });
  assert.deepEqual(branchNode, {
    id: 'branch-1-overview',
    width: 260,
    height: 132,
  });
  assert.deepEqual(graph.edges?.[0], {
    id: 'root-photosynthesis->branch-1-overview',
    sources: ['root-photosynthesis'],
    targets: ['branch-1-overview'],
  });
});

test('translateMindmapToElkGraph rejects edges that reference missing nodes', () => {
  assert.throws(
    () =>
      translateMindmapToElkGraph({
        ...validGeneratedMindmapFixture,
        edges: [
          ...validGeneratedMindmapFixture.edges,
          {
            id: 'ghost-edge',
            from: 'root-photosynthesis',
            to: 'missing-node',
          },
        ],
      }),
    /target node "missing-node" is missing/,
  );
});