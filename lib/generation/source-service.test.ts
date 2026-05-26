import assert from 'node:assert/strict';
import test from 'node:test';

import type { ModelProviderEnv } from '../config/env.ts';
import {
  countMeaningfulNonEmptyLines,
  generateMindmapDslFromSource,
  normalizeGeneratedDsl,
} from './source-service.ts';

const testEnv: ModelProviderEnv = {
  MODEL_PROVIDER: 'openai',
  MODEL_API_KEY: 'test-key',
  MODEL_BASE_URL: undefined,
  MODEL_COMPLETION_MODEL: 'gpt-5-mini',
  MODEL_GENERATION_MODEL: 'gpt-5',
};

test('countMeaningfulNonEmptyLines ignores blank lines', () => {
  assert.equal(countMeaningfulNonEmptyLines('A\n\nB\n  \nC'), 3);
});

test('normalizeGeneratedDsl strips code fences and trims outer whitespace', () => {
  assert.equal(
    normalizeGeneratedDsl('```md\n@root: Topic\n- @branch: Branch\n  - detail\n```\n'),
    '@root: Topic\n- @branch: Branch\n  - detail',
  );
});

test('generateMindmapDslFromSource returns validated DSL metrics for parser-safe output', async () => {
  const response = await generateMindmapDslFromSource(
    {
      sourceText: 'Photosynthesis\nLight reactions\nCalvin cycle\nInputs and outputs\nImportance',
    },
    {
      env: testEnv,
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          dsl: [
            '@root: Photosynthesis',
            '- @branch: Light reactions',
            '  - overview == first energy-conversion stage',
            '  - Inputs',
            '    - light + H2O + ADP + NADP+',
            '  - Outputs',
            '    - O2 + ATP + NADPH',
            '- @branch: Calvin cycle',
            '  - fixes CO2 => carbohydrates',
            '  - stages == fixation + reduction + regeneration',
            '- @branch: Importance',
            '  - supports biomass + food webs',
          ].join('\n'),
        }) } }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  );

  assert.equal(response.dsl.startsWith('@root: Photosynthesis'), true);
  assert.equal(response.metrics.sourceMeaningfulLineCount, 5);
  assert.equal(response.metrics.generatedMeaningfulLineCount, 12);
  assert.equal(response.validation.lineWordLimitSatisfied, true);
  assert.equal(response.validation.expansionTargetSatisfied, true);
  assert.deepEqual(response.validation.parserErrors, []);
});

test('generateMindmapDslFromSource rejects DSL that does not parse under the single-root app rules', async () => {
  await assert.rejects(
    () => generateMindmapDslFromSource(
      {
        sourceText: 'Topic A\nTopic B',
      },
      {
        env: testEnv,
        fetchImpl: async () => new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            dsl: '@root: Topic A\n- @branch: Branch\n@root: Topic B',
          }) } }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    ),
    /parser validation/i,
  );
});

test('generateMindmapDslFromSource rejects lines above the 15-word limit', async () => {
  await assert.rejects(
    () => generateMindmapDslFromSource(
      {
        sourceText: 'Photosynthesis\nStages',
      },
      {
        env: testEnv,
        fetchImpl: async () => new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            dsl: '@root: Photosynthesis\n- @branch: Stages\n  - this line definitely contains more than fifteen distinct words for validation failure in parser-safe testing today',
          }) } }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    ),
    /15-word per-line limit/i,
  );
});