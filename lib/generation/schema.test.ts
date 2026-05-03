import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mindmapGenerationResponseJsonSchema,
  mindmapGenerationResponseSchema,
  validateMindmapGenerationResponse,
} from './schema.ts';

test('validateMindmapGenerationResponse accepts a valid enrichment overlay', () => {
  const parsed = validateMindmapGenerationResponse({
    title: 'Photosynthesis',
    labelRewrites: [
      {
        nodeId: 'branch-1-overview',
        label: 'Core overview',
        reason: 'Clarifies the branch focus.',
      },
    ],
    groupingSuggestions: [
      {
        parentNodeId: 'branch-2-calvin-cycle',
        groupLabel: 'Main phases',
        childNodeIds: ['node-2-1-steps', 'node-2-1-1-fixation'],
        reason: 'These nodes describe one tight process cluster.',
      },
    ],
    suggestedMissingSubtopics: [
      {
        parentNodeId: 'branch-1-overview',
        label: 'Overall equation',
        reason: 'A student usually needs the core input-output summary here.',
      },
    ],
  });

  assert.equal(parsed.groupingSuggestions[0]?.groupLabel, 'Main phases');
});

test('mindmapGenerationResponseSchema rejects duplicate rewrites and repeated grouping children', () => {
  const result = mindmapGenerationResponseSchema.safeParse({
    title: 'Photosynthesis',
    labelRewrites: [
      {
        nodeId: 'branch-1-overview',
        label: 'Core overview',
        reason: 'Clarifies the branch focus.',
      },
      {
        nodeId: 'branch-1-overview',
        label: 'Overview',
        reason: 'Duplicate rewrite.',
      },
    ],
    groupingSuggestions: [
      {
        parentNodeId: 'branch-2-calvin-cycle',
        groupLabel: 'Main phases',
        childNodeIds: ['node-2-1-steps', 'node-2-1-steps'],
        reason: 'Repeated child id.',
      },
    ],
    suggestedMissingSubtopics: [],
  });

  assert.equal(result.success, false);

  if (result.success) {
    return;
  }

  assert(result.error.issues.some((issue) => issue.message.includes('Duplicate label rewrite')));
  assert(result.error.issues.some((issue) => issue.message.includes('childNodeIds must be unique')));
});

test('mindmapGenerationResponseJsonSchema keeps all top-level fields required', () => {
  assert.deepEqual(mindmapGenerationResponseJsonSchema.required, [
    'title',
    'labelRewrites',
    'groupingSuggestions',
    'suggestedMissingSubtopics',
  ]);
  assert.equal(mindmapGenerationResponseJsonSchema.additionalProperties, false);
});