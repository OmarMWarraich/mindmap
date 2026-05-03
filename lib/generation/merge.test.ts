import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from '../mindmap/__fixtures__/generatedMindmap.ts';
import { mergeDeterministicMindmapWithOverlay } from './merge.ts';

test('mergeDeterministicMindmapWithOverlay applies label rewrites and title updates', () => {
  const merged = mergeDeterministicMindmapWithOverlay(validGeneratedMindmapFixture, {
    title: 'Photosynthesis overview',
    labelRewrites: [
      {
        nodeId: 'branch-1-overview',
        label: 'Core overview',
        reason: 'Clarifies the branch focus.',
      },
    ],
    groupingSuggestions: [],
    suggestedMissingSubtopics: [],
  });

  assert.equal(merged.metadata.title, 'Photosynthesis overview');
  assert.equal(
    merged.nodes.find((node) => node.id === 'branch-1-overview')?.label,
    'Core overview',
  );
});

test('mergeDeterministicMindmapWithOverlay inserts grouping wrapper nodes and reparents grouped children', () => {
  const merged = mergeDeterministicMindmapWithOverlay(validGeneratedMindmapFixture, {
    title: 'Photosynthesis',
    labelRewrites: [],
    groupingSuggestions: [
      {
        parentNodeId: 'branch-1-overview',
        groupLabel: 'Key foundations',
        childNodeIds: ['node-1-1-definition', 'node-1-2-why-it-matters'],
        reason: 'These are the introductory overview nodes.',
      },
    ],
    suggestedMissingSubtopics: [],
  });

  const groupNode = merged.nodes.find((node) => node.id === 'branch-1-overview-group-key-foundations');
  const branchNode = merged.nodes.find((node) => node.id === 'branch-1-overview');
  const definitionNode = merged.nodes.find((node) => node.id === 'node-1-1-definition');

  assert.ok(groupNode);
  assert.deepEqual(branchNode?.childIds, ['branch-1-overview-group-key-foundations']);
  assert.equal(definitionNode?.parentId, 'branch-1-overview-group-key-foundations');
  assert.equal(definitionNode?.level, 3);
  assert(merged.edges.some((edge) => edge.id === 'branch-1-overview->branch-1-overview-group-key-foundations'));
});