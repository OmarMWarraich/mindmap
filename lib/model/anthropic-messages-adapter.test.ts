import assert from 'node:assert/strict';
import test from 'node:test';

import { anthropicMessagesAdapter, extractAnthropicText } from './anthropic-messages-adapter.ts';

test('anthropicMessagesAdapter targets the Messages endpoint with auth headers', () => {
  const request = anthropicMessagesAdapter.buildRequest({
    model: 'claude-haiku-4-5',
    messages: [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ],
    maxTokens: 256,
    temperature: 0.2,
    credentials: { apiKey: 'anthropic-key' },
  });

  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');

  const headers = request.init.headers as Record<string, string>;
  assert.equal(headers['x-api-key'], 'anthropic-key');
  assert.equal(headers['anthropic-version'], '2023-06-01');
  assert.equal(headers['Content-Type'], 'application/json');
});

test('anthropicMessagesAdapter lifts system turns and keeps only user/assistant messages', () => {
  const request = anthropicMessagesAdapter.buildRequest({
    model: 'claude-sonnet-4-5',
    messages: [
      { role: 'system', content: 'first system' },
      { role: 'system', content: 'second system' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ],
    maxTokens: 512,
    temperature: 0.1,
    credentials: { apiKey: 'key' },
  });

  const body = JSON.parse(String(request.init.body));
  assert.equal(body.model, 'claude-sonnet-4-5');
  assert.equal(body.max_tokens, 512);
  assert.equal(body.temperature, 0.1);
  assert.equal(body.system, 'first system\n\nsecond system');
  assert.deepEqual(body.messages, [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi there' },
  ]);
  assert.equal('tools' in body, false);
});

test('anthropicMessagesAdapter omits system when no system turn is present', () => {
  const request = anthropicMessagesAdapter.buildRequest({
    model: 'claude-haiku-4-5',
    messages: [{ role: 'user', content: 'only user' }],
    maxTokens: 64,
    temperature: 0.2,
    credentials: { apiKey: 'key' },
  });

  const body = JSON.parse(String(request.init.body));
  assert.equal('system' in body, false);
});

test('anthropicMessagesAdapter honors a custom base URL', () => {
  const request = anthropicMessagesAdapter.buildRequest({
    model: 'claude-haiku-4-5',
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 64,
    temperature: 0.2,
    credentials: { apiKey: 'key', baseUrl: 'https://proxy.example.com/anthropic/' },
  });

  assert.equal(request.url, 'https://proxy.example.com/anthropic/messages');
});

test('anthropicMessagesAdapter maps json_schema structured output to a forced tool call', () => {
  const schema = { type: 'object', additionalProperties: false, required: [], properties: {} };
  const request = anthropicMessagesAdapter.buildRequest({
    model: 'claude-sonnet-4-5',
    messages: [{ role: 'user', content: 'generate overlay' }],
    maxTokens: 800,
    temperature: 0.2,
    credentials: { apiKey: 'key' },
    structuredOutput: {
      kind: 'json_schema',
      name: 'mindmap_overlay',
      schema,
      strict: true,
    },
  });

  const body = JSON.parse(String(request.init.body));
  assert.deepEqual(body.tools, [
    { name: 'mindmap_overlay', input_schema: schema, strict: true },
  ]);
  assert.deepEqual(body.tool_choice, { type: 'tool', name: 'mindmap_overlay' });
});

test('anthropicMessagesAdapter maps json_object structured output to a permissive tool', () => {
  const request = anthropicMessagesAdapter.buildRequest({
    model: 'claude-sonnet-4-5',
    messages: [{ role: 'user', content: 'emit json' }],
    maxTokens: 800,
    temperature: 0.2,
    credentials: { apiKey: 'key' },
    structuredOutput: { kind: 'json_object' },
  });

  const body = JSON.parse(String(request.init.body));
  assert.deepEqual(body.tools, [{ name: 'json_output', input_schema: { type: 'object' } }]);
  assert.deepEqual(body.tool_choice, { type: 'tool', name: 'json_output' });
});

test('extractAnthropicText concatenates text content blocks', () => {
  assert.equal(
    extractAnthropicText({
      content: [
        { type: 'text', text: '  - ATP synthase' },
        { type: 'text', text: ' details' },
      ],
    }),
    '  - ATP synthase details',
  );
});

test('extractAnthropicText returns tool_use input as a JSON string', () => {
  assert.equal(
    extractAnthropicText({
      content: [
        { type: 'tool_use', name: 'mindmap_overlay', input: { dsl: '@root Topic' } },
      ],
    }),
    '{"dsl":"@root Topic"}',
  );
});

test('extractAnthropicText returns an empty string for missing content', () => {
  assert.equal(extractAnthropicText({}), '');
});
