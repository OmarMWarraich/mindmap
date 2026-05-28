import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { mindmapAstFixture } from '../../../lib/mindmap/__fixtures__/generatedMindmap.ts';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

mock.module('../../../auth.ts', {
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

test('generation route returns a validated overlay for a valid request', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      title: 'Photosynthesis',
      labelRewrites: [{
        nodeId: 'branch-1-overview',
        label: 'Core overview',
        reason: 'Clarifies the branch focus.',
      }],
      groupingSuggestions: [],
      suggestedMissingSubtopics: [{
        parentNodeId: 'branch-2-calvin-cycle',
        label: 'Energy cost',
        reason: 'Students usually need the ATP and NADPH requirement here.',
      }],
    }) } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-user-id',
      },
      body: JSON.stringify({
        rawDsl: '@root: Photosynthesis\n- @branch: Overview\n  - Definition',
        ast: mindmapAstFixture,
        warnings: [{
          severity: 'warning',
          code: 'empty-line-skipped',
          message: 'Skipped an empty line while parsing.',
          target: {},
        }],
        errors: [{
          severity: 'error',
          code: 'recovered-structure',
          message: 'Recovered a malformed subsection.',
          target: {},
        }],
      }),
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.fallbackUsed, false);
    assert.deepEqual(payload.overlay, {
      title: 'Photosynthesis',
      labelRewrites: [{
        nodeId: 'branch-1-overview',
        label: 'Core overview',
        reason: 'Clarifies the branch focus.',
      }],
      groupingSuggestions: [],
      suggestedMissingSubtopics: [{
        parentNodeId: 'branch-2-calvin-cycle',
        label: 'Energy cost',
        reason: 'Students usually need the ATP and NADPH requirement here.',
      }],
    });
    assert.deepEqual(payload.suggestedMissingSubtopics, [{
      parentNodeId: 'branch-2-calvin-cycle',
      label: 'Energy cost',
      reason: 'Students usually need the ATP and NADPH requirement here.',
    }]);
    assert.equal(payload.warnings.length, 1);
    assert.equal(payload.errors.length, 1);
    assert.equal(payload.mindmap.metadata.title, 'Photosynthesis');
    assert.equal(
      payload.mindmap.nodes.find((node: { id: string; label: string }) => node.id === 'branch-1-overview')?.label,
      'Core overview',
    );
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('generation route falls back to the deterministic mindmap when the model output is invalid', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: 'not valid json' } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-user-id',
      },
      body: JSON.stringify({
        rawDsl: '@root: Photosynthesis\n- @branch: Overview\n  - Definition',
        ast: mindmapAstFixture,
        warnings: [],
        errors: [{
          severity: 'error',
          code: 'recovered-structure',
          message: 'Recovered a malformed subsection.',
          target: {},
        }],
      }),
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.fallbackUsed, true);
    assert.equal(payload.mindmap.metadata.title, 'Photosynthesis');
    assert.equal(payload.errors.length, 1);
    assert.deepEqual(payload.overlay, {
      title: 'Photosynthesis',
      labelRewrites: [],
      groupingSuggestions: [],
      suggestedMissingSubtopics: [],
    });
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('generation route rejects invalid request payloads', async () => {
  const response = await POST(new Request('http://localhost/api/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': 'test-user-id',
    },
    body: JSON.stringify({ rawDsl: 12 }),
  }));

  assert.equal(response.status, 400);
});

test('generation route rejects unauthenticated requests', async () => {
  const response = await POST(new Request('http://localhost/api/generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawDsl: '@root: Test' }),
  }));

  assert.equal(response.status, 401);
});
