import assert from 'node:assert/strict';
import test from 'node:test';

import { generateInlineCompletion } from './service.ts';

interface CapturedCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function captureFetch(responseBody: unknown): {
  fetchImpl: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const baseRequest = {
  outline: '@root: Topic\n- @branch: Cellular respiration',
  cursor: { lineNumber: 2, column: 28 },
} as const;

test('generateInlineCompletion dispatches an explicit openai modelId to the chat-completions endpoint', async () => {
  const { fetchImpl, calls } = captureFetch({
    choices: [{ message: { content: 'ynthase' } }],
  });

  await generateInlineCompletion(
    { ...baseRequest, modelId: 'gpt-4o-mini' },
    { env: { OPENAI_API_KEY: 'sk-openai-test' }, fetchImpl },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith('/chat/completions'), true);
  assert.equal(calls[0].headers.Authorization, 'Bearer sk-openai-test');
  assert.equal(calls[0].body.model, 'gpt-4o-mini');
  assert.equal(calls[0].body.max_completion_tokens, 72);
});

test('generateInlineCompletion dispatches an explicit anthropic modelId over the Messages wire format', async () => {
  const { fetchImpl, calls } = captureFetch({
    content: [{ type: 'text', text: 'ynthase' }],
  });

  await generateInlineCompletion(
    { ...baseRequest, modelId: 'claude-haiku-4-5' },
    { env: { ANTHROPIC_API_KEY: 'sk-ant-test' }, fetchImpl },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith('/messages'), true);
  assert.equal(calls[0].headers['x-api-key'], 'sk-ant-test');
  assert.equal(calls[0].body.model, 'claude-haiku-4-5');
  assert.equal(calls[0].body.max_tokens, 72);
  // Inline completion is free text, so no structured-output tooling is attached.
  assert.equal('tools' in calls[0].body, false);
});

test('generateInlineCompletion falls back to the completion-role default model when modelId is omitted', async () => {
  const { fetchImpl, calls } = captureFetch({
    choices: [{ message: { content: 'ynthase' } }],
  });

  await generateInlineCompletion(
    baseRequest,
    { env: { OPENAI_API_KEY: 'sk-openai-test' }, fetchImpl },
  );

  assert.equal(calls[0].url.endsWith('/chat/completions'), true);
  assert.equal(calls[0].body.model, 'gpt-4o-mini');
});
