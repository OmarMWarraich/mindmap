import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { resetInlineCompletionRuntimeControlsForTests } from '../../../lib/completion/runtime-controls.ts';

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

test('completion route returns model output for a valid request', async () => {
  const originalEnv = {
    ...process.env,
  };
  const originalFetch = globalThis.fetch;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;

  resetInlineCompletionRuntimeControlsForTests();

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '  - ATP synthase' } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-user-id',
      },
      body: JSON.stringify({
        outline: '@root: Photosynthesis\n- @branch: Light reactions\n  - ATP synth',
        cursor: { lineNumber: 3, column: 10 },
      }),
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      completionText: 'ynthase',
      source: 'model',
    });
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('completion route drops off-topic model output after relevance filtering', async () => {
  const originalEnv = {
    ...process.env,
  };
  const originalFetch = globalThis.fetch;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;

  resetInlineCompletionRuntimeControlsForTests();

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: 'French Revolution causes' } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-user-id',
      },
      body: JSON.stringify({
        outline: '@root: Photosynthesis\n- @branch: Light reactions\n  - ATP synth',
        cursor: { lineNumber: 3, column: 10 },
      }),
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      completionText: '',
      source: 'model',
    });
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('completion route drops duplicate nearby sibling suggestions', async () => {
  const originalEnv = {
    ...process.env,
  };
  const originalFetch = globalThis.fetch;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;

  resetInlineCompletionRuntimeControlsForTests();

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: 'NADPH output' } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-user-id',
      },
      body: JSON.stringify({
        outline: '@root: Photosynthesis\n- @branch: Light reactions\n  - ATP synth\n  - proton gradient\n  - NADPH output',
        cursor: { lineNumber: 3, column: 10 },
      }),
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      completionText: '',
      source: 'model',
    });
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('completion route rejects invalid request payloads', async () => {
  resetInlineCompletionRuntimeControlsForTests();

  const response = await POST(new Request('http://localhost/api/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': 'test-user-id',
    },
    body: JSON.stringify({ outline: 12 }),
  }));

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid input|expected string/i);
});

test('completion route serves identical requests from cache before calling fetch again', async () => {
  const originalEnv = {
    ...process.env,
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;
  resetInlineCompletionRuntimeControlsForTests();

  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      choices: [{ message: { content: '  - ATP synthase' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const request = new Request('http://localhost/api/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.8',
      'x-test-user-id': 'test-user-id',
    },
    body: JSON.stringify({
      outline: '@root: Photosynthesis\n- @branch: Light reactions\n  - ATP synth',
      cursor: { lineNumber: 3, column: 10 },
    }),
  });

  try {
    const firstResponse = await POST(request.clone());
    const secondResponse = await POST(request.clone());

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.equal(fetchCalls, 1);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('completion route returns 429 after repeated burst requests from the same client', async () => {
  const originalEnv = {
    ...process.env,
  };
  const originalFetch = globalThis.fetch;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;
  resetInlineCompletionRuntimeControlsForTests();

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '  - ATP synthase' } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt < 19; attempt += 1) {
      lastResponse = await POST(new Request('http://localhost/api/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.9',
          'x-test-user-id': 'test-user-id',
        },
        body: JSON.stringify({
          outline: `@root: Photosynthesis\n- @branch: Light reactions\n  - ATP synth ${attempt}`,
          cursor: { lineNumber: 3, column: 10 },
        }),
      }));
    }

    assert.ok(lastResponse);
    assert.equal(lastResponse.status, 429);
    assert.equal(lastResponse.headers.get('Retry-After'), '30');
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('completion route rejects unauthenticated requests', async () => {
  resetInlineCompletionRuntimeControlsForTests();

  const response = await POST(new Request('http://localhost/api/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outline: '@root: Test',
      cursor: { lineNumber: 1, column: 5 },
    }),
  }));

  assert.equal(response.status, 401);
});
