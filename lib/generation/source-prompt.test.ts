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

test('createSourceMindmapGenerationPrompt prefers plain-language labels when readabilityMode is plain', () => {
  const prompt = createSourceMindmapGenerationPrompt({
    sourceText: 'Growth\nCompliance\nInclusion',
    sourceMeaningfulLineCount: 3,
    targetMinLineCount: 8,
    targetMaxLineCount: 12,
    detailLevel: 'detailed',
    readabilityMode: 'plain',
  });

  assert.match(prompt.user, /prefer plain-language labels/i);
  assert.match(prompt.user, /avoid symbols such as =, \+, =>, and ->/i);
  assert.match(prompt.user, /add rich explanatory child lines/i);
  assert.match(prompt.user, /Detail preference: detailed: prefer the upper half of the target range/i);
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

test('createSourceMindmapGenerationPrompt leads with explicit hierarchy detection in both modes', () => {
  const expand = createSourceMindmapGenerationPrompt({
    sourceText: 'A wall of unstructured prose with no headings at all.',
    sourceMeaningfulLineCount: 1,
    targetMinLineCount: 3,
    targetMaxLineCount: 4,
    detailLevel: 'standard',
  });

  assert.match(expand.user, /detect the topic hierarchy/i);
  assert.match(expand.user, /umbrella topic/i);
  assert.match(expand.user, /infer the hierarchy from meaning/i);
});

test('createSourceMindmapGenerationPrompt uses the condensation variant in distill mode', () => {
  const distill = createSourceMindmapGenerationPrompt({
    sourceText: 'Very long transcript text…',
    sourceMeaningfulLineCount: 80,
    targetMinLineCount: 12,
    targetMaxLineCount: 60,
    detailLevel: 'standard',
    mode: 'distill',
  });

  assert.match(distill.user, /detect the topic hierarchy/i);
  assert.match(distill.user, /Condense the long source/i);
  assert.match(distill.user, /Do NOT expand/i);
  assert.match(distill.user, /Detail preference: standard: keep only the essential structure/i);
  assert.match(distill.user, /Target generated meaningful line count range: 12 to 60/);
});

test('createSourceMindmapGenerationPrompt preserves source text containing $-replacement patterns verbatim', () => {
  // "$&", "$$", and "$1" are special String.prototype.replace substitution
  // patterns. Source text (and a previous DSL attempt) must be inserted
  // literally, not interpreted as replacement patterns.
  const sourceText = 'Budget is $$500, refund code $& applies, tier $1 unlocked.';
  const prompt = createSourceMindmapGenerationPrompt({
    sourceText,
    sourceMeaningfulLineCount: 1,
    targetMinLineCount: 3,
    targetMaxLineCount: 4,
    detailLevel: 'standard',
    previousDslAttempt: '@root: $$Prior $& Attempt $1',
    retryReason: 'too sparse',
  });

  assert.ok(prompt.user.includes(sourceText));
  assert.ok(prompt.user.includes('@root: $$Prior $& Attempt $1'));
  assert.ok(!prompt.user.includes('{{SOURCE_TEXT}}'));
  assert.ok(!prompt.user.includes('{{RETRY_BLOCK}}'));
});