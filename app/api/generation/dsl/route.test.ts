import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

mock.module('../../../../auth.ts', {
  namedExports: {
    auth: (handler: Function) => (req: Request) => {
      const userId = req.headers.get('x-test-user-id');
      if (userId) {
        (req as any).auth = { user: { id: userId } };
      }
      return handler(req);
    },
  },
});

const { POST } = await import('./route.ts') as unknown as { POST: (req: Request) => Promise<Response> };

test('dsl generation route returns validated DSL output for a valid request', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  process.env.OPENAI_API_KEY = 'sk-openai-test';
  delete process.env.ANTHROPIC_API_KEY;

  globalThis.fetch = async () => new Response(JSON.stringify({
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
  });

  try {
    const response = await POST(new Request('http://localhost/api/generation/dsl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-user-id',
      },
      body: JSON.stringify({
        sourceText: 'Photosynthesis\nLight reactions\nCalvin cycle\nInputs and outputs\nImportance',
      }),
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.dsl.startsWith('@root: Photosynthesis'), true);
    assert.equal(payload.metrics.sourceMeaningfulLineCount, 5);
    assert.equal(payload.metrics.generatedMeaningfulLineCount, 12);
    assert.equal(payload.validation.lineWordLimitSatisfied, true);
    assert.equal(payload.validation.expansionTargetSatisfied, true);
    assert.equal(payload.quality.mode, 'retry');
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('dsl generation route rejects invalid request payloads', async () => {
  const response = await POST(new Request('http://localhost/api/generation/dsl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': 'test-user-id',
    },
    body: JSON.stringify({ sourceText: 12 }),
  }));

  assert.equal(response.status, 400);
});

test('dsl generation route surfaces model output validation failures', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  process.env.OPENAI_API_KEY = 'sk-openai-test';
  delete process.env.ANTHROPIC_API_KEY;

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      dsl: '@root: Topic A\n- @branch: Branch\n@root: Topic B',
    }) } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/generation/dsl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-user-id',
      },
      body: JSON.stringify({
        sourceText: 'Topic A\nTopic B',
      }),
    }));

    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.match(payload.error, /parser validation/i);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('dsl generation route rejects unauthenticated requests', async () => {
  const response = await POST(new Request('http://localhost/api/generation/dsl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceText: 'Topic A' }),
  }));

  assert.equal(response.status, 401);
});
