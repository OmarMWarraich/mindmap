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
  assert.equal(response.quality.mode, 'retry');
  assert.equal(response.quality.attemptCount, 2);
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

test('generateMindmapDslFromSource salvages Main Topic and Sub Topic style output into valid DSL', async () => {
  const response = await generateMindmapDslFromSource(
    {
      sourceText: [
        'Main Topic: Aspects',
        'Sub Topic: Introduction to the Aspects',
        'Sub Topic: Political Theory',
        'Sub Topic: Comparative Politics',
        'Sub Topic: Public Administration',
        'Sub Topic: International Relations',
        'Sub Topic: Political Economy',
      ].join('\n'),
    },
    {
      env: testEnv,
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          dsl: [
            'Main Topic: Aspects',
            'Sub Topic: Introduction to the Aspects',
            'Sub Topic: Political Theory',
            'Sub Topic: Comparative Politics',
            'Sub Topic: Public Administration',
            'Sub Topic: International Relations',
            'Sub Topic: Political Economy',
          ].join('\n'),
        }) } }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  );

  assert.equal(response.dsl, [
    '@root: Aspects',
    '- @branch: Introduction to the Aspects',
    '- @branch: Political Theory',
    '- @branch: Comparative Politics',
    '- @branch: Public Administration',
    '- @branch: International Relations',
    '- @branch: Political Economy',
  ].join('\n'));
  assert.equal(response.quality.mode, 'retry');
  assert.deepEqual(response.validation.parserErrors, []);
});

test('generateMindmapDslFromSource retries when the first parser-safe result is too sparse', async () => {
  let requestCount = 0;

  const response = await generateMindmapDslFromSource(
    {
      sourceText: [
        'Main Topic: Aspects',
        'Sub Topic: Introduction to the Aspects',
        'Sub Topic: Political Theory',
        'Sub Topic: Comparative Politics',
        'Sub Topic: Public Administration',
        'Sub Topic: International Relations',
        'Sub Topic: Political Economy',
        'Sub Topic: Political Sociology',
        'Sub Topic: Public Law',
        'Sub Topic: Political Philosophy',
        'Sub Topic: Comparative Government',
        'Sub Topic: Development Studies',
      ].join('\n'),
    },
    {
      env: testEnv,
      fetchImpl: async () => {
        requestCount += 1;

        if (requestCount === 1) {
          return new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({
              dsl: [
                '@root: Aspects',
                '- @branch: Introduction to the Aspects',
                '- @branch: Political Theory',
                '- @branch: Comparative Politics',
                '- @branch: Public Administration',
                '- @branch: International Relations',
                '- @branch: Political Economy',
                '- @branch: Political Sociology',
                '- @branch: Public Law',
                '- @branch: Political Philosophy',
                '- @branch: Comparative Government',
                '- @branch: Development Studies',
              ].join('\n'),
            }) } }],
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            dsl: [
              '@root: Aspects of Political Science',
              '- @branch: Introduction to the Aspects',
              '  - aspects identify major divisions within the political science field',
              '  - each division studies politics from a different analytical viewpoint',
              '- @branch: Political Theory',
              '  - political theory develops concepts of justice, liberty, equality, and state',
              '  - it interprets ideals guiding institutions, authority, and citizenship',
              '- @branch: Comparative Politics',
              '  - it compares political systems, parties, institutions, and regimes',
              '  - comparison explains why countries produce different political outcomes',
              '- @branch: Public Administration',
              '  - this aspect studies bureaucracy, management, accountability, and service delivery',
              '  - it focuses on implementing laws, programs, and public policy',
              '- @branch: International Relations',
              '  - it studies relations among states, organizations, and global actors',
              '  - war, diplomacy, trade, and cooperation shape this field',
              '- @branch: Political Economy',
              '  - political economy links economic resources with political power structures',
              '  - it studies markets, classes, taxation, and development choices',
              '- @branch: Political Sociology',
              '  - this aspect studies how society shapes political behavior and institutions',
              '  - class, religion, identity, and groups influence political life',
              '- @branch: Public Law',
              '  - public law studies constitutional, administrative, and governmental legal rules',
              '  - it defines powers, limits, rights, and institutional responsibilities',
              '- @branch: Political Philosophy',
              '  - it asks foundational questions about justice, morality, and authority',
              '  - it evaluates ideal political order and ethical public conduct',
              '- @branch: Comparative Government',
              '  - comparative government examines constitutions, executives, legislatures, and courts',
              '  - it contrasts parliamentary, presidential, unitary, and federal systems',
              '- @branch: Development Studies',
              '  - development studies explores political change in developing societies',
              '  - it links governance, growth, welfare, participation, reform, and modernization',
            ].join('\n'),
          }) } }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  );

  assert.equal(requestCount, 2);
  assert.equal(response.dsl.startsWith('@root: Aspects of Political Science'), true);
  assert.equal(response.validation.expansionTargetSatisfied, true);
  assert.equal(response.quality.mode, 'retry');
  assert.equal(response.quality.attemptCount, 2);
  assert.equal(response.quality.densityStatus, 'target-met');
});

test('generateMindmapDslFromSource reports below-target density when even the retry remains too sparse', async () => {
  const response = await generateMindmapDslFromSource(
    {
      sourceText: 'Main Topic: Aspects\nSub Topic: Political Theory\nSub Topic: Public Law',
      detailLevel: 'detailed',
    },
    {
      env: testEnv,
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          dsl: '@root: Aspects\n- @branch: Political Theory\n  - studies ideas of justice\n- @branch: Public Law\n  - studies constitutional rules',
        }) } }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  );

  assert.equal(response.validation.expansionTargetSatisfied, false);
  assert.equal(response.quality.densityStatus, 'below-target');
});

test('generateMindmapDslFromSource retries detailed generation when the first result mostly mirrors the source labels', async () => {
  let requestCount = 0;

  const response = await generateMindmapDslFromSource(
    {
      sourceText: [
        'Photosynthesis',
        'Light reactions',
        'Calvin cycle',
        'Importance',
      ].join('\n'),
      detailLevel: 'detailed',
    },
    {
      env: testEnv,
      fetchImpl: async () => {
        requestCount += 1;

        if (requestCount === 1) {
          return new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({
              dsl: [
                '@root: Photosynthesis',
                '- @branch: Light reactions',
                '  - Light reactions',
                '  - captures light energy in chloroplast membranes',
                '- @branch: Calvin cycle',
                '  - Calvin cycle',
                '  - fixes carbon dioxide into sugars',
                '- @branch: Importance',
                '  - Importance',
                '  - supports glucose formation for plant growth',
              ].join('\n'),
            }) } }],
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            dsl: [
              '@root: Photosynthesis',
              '- @branch: Light reactions',
              '  - converts light energy into ATP and NADPH',
              '  - water splitting releases oxygen as a by-product',
              '- @branch: Calvin cycle',
              '  - uses ATP and NADPH to fix carbon dioxide',
              '  - produces carbohydrate precursors in the stroma',
              '- @branch: Importance',
              '  - stores solar energy in organic molecules',
              '  - sustains plant biomass and food chains',
            ].join('\n'),
          }) } }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  );

  assert.equal(requestCount, 2);
  assert.equal(response.quality.mode, 'retry');
  assert.match(response.dsl, /converts light energy into ATP and NADPH/i);
});