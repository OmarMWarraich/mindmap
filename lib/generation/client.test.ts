import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSourceMindmapGenerationClientResponse,
  requestMindmapDslGenerationFromApi,
} from './client.ts';

test('parseSourceMindmapGenerationClientResponse accepts the expected route payload', () => {
  assert.deepEqual(parseSourceMindmapGenerationClientResponse({
    dsl: '@root: Photosynthesis',
    metrics: {
      sourceMeaningfulLineCount: 3,
      generatedMeaningfulLineCount: 7,
      expansionRatio: 2.33,
      targetMinLineCount: 7,
      targetMaxLineCount: 8,
      maxWordsPerLine: 15,
    },
    validation: {
      parserWarnings: [],
      parserErrors: [],
      lineWordLimitSatisfied: true,
      expansionTargetSatisfied: true,
    },
  }), {
    dsl: '@root: Photosynthesis',
    metrics: {
      sourceMeaningfulLineCount: 3,
      generatedMeaningfulLineCount: 7,
      expansionRatio: 2.33,
      targetMinLineCount: 7,
      targetMaxLineCount: 8,
      maxWordsPerLine: 15,
    },
    validation: {
      parserWarnings: [],
      parserErrors: [],
      lineWordLimitSatisfied: true,
      expansionTargetSatisfied: true,
    },
  });
});

test('parseSourceMindmapGenerationClientResponse rejects malformed payloads', () => {
  assert.throws(() => parseSourceMindmapGenerationClientResponse(null), /invalid response payload/i);
  assert.throws(
    () => parseSourceMindmapGenerationClientResponse({ metrics: {}, validation: {} }),
    /missing DSL output/i,
  );
});

test('requestMindmapDslGenerationFromApi posts raw notes to the DSL generation endpoint', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  const response = await requestMindmapDslGenerationFromApi(
    {
      sourceText: 'Photosynthesis\nLight reactions\nCalvin cycle',
    },
    {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;

        return new Response(JSON.stringify({
          dsl: '@root: Photosynthesis',
          metrics: {
            sourceMeaningfulLineCount: 3,
            generatedMeaningfulLineCount: 7,
            expansionRatio: 2.33,
            targetMinLineCount: 7,
            targetMaxLineCount: 8,
            maxWordsPerLine: 15,
          },
          validation: {
            parserWarnings: [],
            parserErrors: [],
            lineWordLimitSatisfied: true,
            expansionTargetSatisfied: true,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  );

  assert.equal(requestUrl, '/api/generation/dsl');
  assert.equal(requestInit?.method, 'POST');
  assert.equal(response.dsl, '@root: Photosynthesis');
});

test('requestMindmapDslGenerationFromApi surfaces route errors', async () => {
  await assert.rejects(
    () => requestMindmapDslGenerationFromApi(
      {
        sourceText: 'Photosynthesis',
      },
      {
        fetchImpl: async () => new Response(JSON.stringify({
          error: 'Generated DSL did not pass parser validation.',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    ),
    /parser validation/i,
  );
});