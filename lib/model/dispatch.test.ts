import assert from 'node:assert/strict';
import { test } from 'node:test';

import { requestStructuredModelCompletion } from './dispatch.ts';

const openaiKey = { OPENAI_API_KEY: 'sk-real-openai-key' };
const anthropicKey = { ANTHROPIC_API_KEY: 'sk-real-anthropic-key' };

const jsonSchema = {
  kind: 'json_schema' as const,
  name: 'demo',
  strict: true,
  schema: { type: 'object' as const },
};

function captureFetch(responseBody: unknown): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; body: Record<string, unknown> }>;
} {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test('uses response_format for an openai-compatible model and parses choices', async () => {
  const { fetchImpl, calls } = captureFetch({
    choices: [{ message: { content: '{"ok":true}' } }],
  });

  const result = await requestStructuredModelCompletion({
    role: 'generation',
    modelId: 'gpt-5.4',
    env: openaiKey,
    fetchImpl,
    maxTokens: 256,
    structuredOutput: jsonSchema,
    messages: [{ role: 'user', content: 'hi' }],
  });

  assert.equal(result.modelId, 'gpt-5.4');
  assert.equal(result.structuredOutputStrategy, 'response_format');
  assert.equal(result.text, '{"ok":true}');
  assert.equal(calls[0].url.endsWith('/chat/completions'), true);
  assert.equal((calls[0].body.response_format as { type: string }).type, 'json_schema');
  assert.equal('tools' in calls[0].body, false);
});

test('uses tool/tool_choice for an anthropic model and parses tool_use input', async () => {
  const { fetchImpl, calls } = captureFetch({
    content: [{ type: 'tool_use', name: 'demo', input: { ok: true } }],
  });

  const result = await requestStructuredModelCompletion({
    role: 'generation',
    modelId: 'claude-sonnet-4-5',
    env: anthropicKey,
    fetchImpl,
    maxTokens: 256,
    structuredOutput: jsonSchema,
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ],
  });

  assert.equal(result.modelId, 'claude-sonnet-4-5');
  assert.equal(result.structuredOutputStrategy, 'tool');
  assert.equal(result.text, '{"ok":true}');
  assert.equal(calls[0].url.endsWith('/messages'), true);
  assert.equal(Array.isArray(calls[0].body.tools), true);
  assert.deepEqual(calls[0].body.tool_choice, { type: 'tool', name: 'demo' });
  assert.equal('response_format' in calls[0].body, false);
});

test('sends the catalog default temperature for a model that supports it', async () => {
  const { fetchImpl, calls } = captureFetch({
    choices: [{ message: { content: '{}' } }],
  });

  await requestStructuredModelCompletion({
    role: 'generation',
    modelId: 'gpt-5.4',
    env: openaiKey,
    fetchImpl,
    maxTokens: 256,
    messages: [{ role: 'user', content: 'hi' }],
  });

  assert.equal(calls[0].body.temperature, 0.2);
});

test('omits temperature for an openai model that only allows the default value', async () => {
  const { fetchImpl, calls } = captureFetch({
    choices: [{ message: { content: '{}' } }],
  });

  await requestStructuredModelCompletion({
    role: 'generation',
    modelId: 'gpt-5.5',
    env: openaiKey,
    fetchImpl,
    maxTokens: 256,
    temperature: 0.2,
    messages: [{ role: 'user', content: 'hi' }],
  });

  assert.equal('temperature' in calls[0].body, false);
});

test('omits temperature for an anthropic model that deprecated it', async () => {
  const { fetchImpl, calls } = captureFetch({
    content: [{ type: 'text', text: '{}' }],
  });

  await requestStructuredModelCompletion({
    role: 'generation',
    modelId: 'claude-opus-4-8',
    env: anthropicKey,
    fetchImpl,
    maxTokens: 256,
    temperature: 0.2,
    messages: [{ role: 'user', content: 'hi' }],
  });

  assert.equal(calls[0].url.endsWith('/messages'), true);
  assert.equal('temperature' in calls[0].body, false);
});

test('falls back to the role default model when modelId is omitted', async () => {
  // Default is now an Anthropic model, so the role-default path resolves against
  // ANTHROPIC_API_KEY and the anthropic-messages response shape.
  const { fetchImpl } = captureFetch({ content: [{ type: 'text', text: '' }] });

  const result = await requestStructuredModelCompletion({
    role: 'generation',
    env: anthropicKey,
    fetchImpl,
    maxTokens: 256,
    structuredOutput: jsonSchema,
    messages: [{ role: 'user', content: 'hi' }],
  });

  assert.equal(result.modelId, 'claude-haiku-4-5');
});
