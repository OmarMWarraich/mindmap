import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSourceMindmapGenerationPrompt,
  sourceMindmapGenerationOutputContract,
  sourceMindmapGenerationSystemPrompt,
} from './source-prompt.ts';

test('source mindmap generation system prompt requires exactly one root and strict JSON', () => {
  assert.match(sourceMindmapGenerationSystemPrompt, /Return one JSON object/i);
  assert.match(sourceMindmapGenerationSystemPrompt, /exactly one @root/i);
  assert.match(sourceMindmapGenerationSystemPrompt, /35 words or fewer/i);
});

test('createSourceMindmapGenerationPrompt injects source density targets', () => {
  const prompt = createSourceMindmapGenerationPrompt({
    sourceText: 'Photosynthesis\nLight reactions\nCalvin cycle',
    sourceMeaningfulLineCount: 3,
    targetMinLineCount: 7,
    targetMaxLineCount: 8,
    detailLevel: 'standard',
  });

  assert.match(prompt.user, /Source meaningful non-empty line count: 3/);
  assert.match(prompt.user, /Target generated meaningful line count range: 7 to 8/);
  assert.match(prompt.user, /Every branch should normally contain at least 2 child lines/i);
  assert.match(prompt.user, /Detail preference: standard/i);
  assert.match(prompt.user, /instead of mirroring the notes verbatim/i);
  assert.match(prompt.user, /SOURCE NOTES:/);
  assert.match(prompt.user, /Photosynthesis/);
  assert.match(
    prompt.user,
    new RegExp(sourceMindmapGenerationOutputContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 20)),
  );
});

test('createSourceMindmapGenerationPrompt includes retry guidance when revising a sparse attempt', () => {
  const prompt = createSourceMindmapGenerationPrompt({
    sourceText: 'Main Topic: Aspects\nSub Topic: Political Theory',
    sourceMeaningfulLineCount: 2,
    targetMinLineCount: 5,
    targetMaxLineCount: 6,
    detailLevel: 'detailed',
    previousDslAttempt: '@root: Aspects\n- @branch: Political Theory',
    retryReason: 'The outline is too sparse for the target line-count range.',
    retryGuidance: [
      'Keep the same topic coverage, but add concise explanatory child lines.',
      'Expand branches with clarifications, mechanisms, examples, or outcomes.',
    ].join('\n'),
  });

  assert.match(prompt.user, /REVISION REQUIRED:/);
  assert.match(prompt.user, /Previous DSL attempt was too weak/i);
  assert.match(prompt.user, /Detail preference: detailed/i);
  assert.match(prompt.user, /at least 3 child lines/i);
  assert.match(prompt.user, /copied headings as invalid/i);
  assert.match(prompt.user, /Expand branches with clarifications, mechanisms, examples, or outcomes/i);
  assert.match(prompt.user, /@root: Aspects/);
});