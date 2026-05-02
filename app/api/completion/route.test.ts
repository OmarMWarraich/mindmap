import assert from 'node:assert/strict';
import test from 'node:test';

import { POST } from './route.ts';

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

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '  - ATP synthase' } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: 'French Revolution causes' } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

test('completion route rejects invalid request payloads', async () => {
  const response = await POST(new Request('http://localhost/api/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outline: 12 }),
  }));

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid input|expected string/i);
});