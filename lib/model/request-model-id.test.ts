import assert from 'node:assert/strict';
import test from 'node:test';

import { inlineCompletionRequestSchema } from '../completion/service.ts';
import { generationRequestSchema } from '../generation/service.ts';
import { sourceMindmapGenerationRequestSchema } from '../generation/source-schema.ts';

const baseCompletion = {
  outline: '@root: Photosynthesis',
  cursor: { lineNumber: 1, column: 1 },
};

const baseGeneration = {
  rawDsl: '@root: Photosynthesis',
  ast: {
    root: {
      id: 'root',
      kind: 'root' as const,
      label: 'Photosynthesis',
      source: { line: 1, column: 1, indentLevel: 0, raw: '@root: Photosynthesis' },
      branches: [],
    },
  },
};

const baseSource = { sourceText: 'Photosynthesis notes' };

test('request schemas remain valid when modelId is omitted (backward compatible)', () => {
  assert.equal(inlineCompletionRequestSchema.safeParse(baseCompletion).success, true);
  assert.equal(generationRequestSchema.safeParse(baseGeneration).success, true);
  assert.equal(sourceMindmapGenerationRequestSchema.safeParse(baseSource).success, true);
});

test('request schemas accept a known catalog modelId', () => {
  assert.equal(
    inlineCompletionRequestSchema.safeParse({ ...baseCompletion, modelId: 'gpt-5.4' }).success,
    true,
  );
  assert.equal(
    generationRequestSchema.safeParse({ ...baseGeneration, modelId: 'claude-sonnet-4-5' }).success,
    true,
  );
  assert.equal(
    sourceMindmapGenerationRequestSchema.safeParse({ ...baseSource, modelId: 'gpt-5.5' }).success,
    true,
  );
});

test('request schemas reject an unknown modelId', () => {
  assert.equal(
    inlineCompletionRequestSchema.safeParse({ ...baseCompletion, modelId: 'no-such-model' }).success,
    false,
  );
  assert.equal(
    generationRequestSchema.safeParse({ ...baseGeneration, modelId: 'no-such-model' }).success,
    false,
  );
  assert.equal(
    sourceMindmapGenerationRequestSchema.safeParse({ ...baseSource, modelId: 'no-such-model' }).success,
    false,
  );
});
