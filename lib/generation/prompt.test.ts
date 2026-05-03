import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from '../mindmap/__fixtures__/generatedMindmap.ts';
import {
  createMindmapGenerationPrompt,
  mindmapGenerationOutputContract,
  mindmapGenerationSystemPrompt,
} from './prompt.ts';

test('mindmap generation system prompt requires strict JSON output', () => {
  assert.match(mindmapGenerationSystemPrompt, /return one JSON object/i);
  assert.match(mindmapGenerationSystemPrompt, /Do not invent node ids/i);
});

test('createMindmapGenerationPrompt injects deterministic mindmap context', () => {
  const prompt = createMindmapGenerationPrompt({
    astSummary: 'Root: Photosynthesis\nBranches: Overview, Calvin cycle',
    rawDsl: '@root: Photosynthesis\n- @branch: Overview\n  - Definition',
    deterministicMindmap: validGeneratedMindmapFixture,
  });

  assert.match(prompt.user, /AST SUMMARY:/);
  assert.match(prompt.user, /RAW DSL:/);
  assert.match(prompt.user, /DETERMINISTIC MINDMAP JSON:/);
  assert.match(prompt.user, /branch-1-overview/);
  assert.match(prompt.user, new RegExp(mindmapGenerationOutputContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40)));
});