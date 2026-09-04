import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractAssistantText,
  openaiCompatibleAdapter,
} from './openai-compatible-adapter.ts';

test('extractAssistantText supports both string and text-part chat payloads', () => {
  assert.equal(
    extractAssistantText({
      choices: [{ message: { content: '  - ATP synthase' } }],
    }),
    '  - ATP synthase',
  );

  assert.equal(
    extractAssistantText({
      choices: [{ message: { content: [{ type: 'text', text: '  - proton gradient' }] } }],
    }),
    '  - proton gradient',
  );
});

test('openaiCompatibleAdapter advertises the openai-compatible wire format', () => {
  assert.equal(openaiCompatibleAdapter.wireFormat, 'openai-compatible');
});

test('openaiCompatibleAdapter builds a Bearer-authenticated chat-completions request', () => {
  const request = openaiCompatibleAdapter.buildRequest({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ],
    maxTokens: 256,
    temperature: 0.2,
    credentials: { apiKey: 'sk-credential' },
  });

  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');

  const headers = request.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer sk-credential');
  assert.equal(headers['Content-Type'], 'application/json');

  const body = JSON.parse(String(request.init.body));
  assert.equal(body.model, 'gpt-4o-mini');
  assert.equal(body.max_completion_tokens, 256);
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'user prompt' },
  ]);
  assert.equal('response_format' in body, false);
});

test('openaiCompatibleAdapter honors a custom base URL and strips trailing slashes', () => {
  const request = openaiCompatibleAdapter.buildRequest({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 64,
    temperature: 0.2,
    credentials: { apiKey: 'key', baseUrl: 'https://proxy.example.com/v1/' },
  });

  assert.equal(request.url, 'https://proxy.example.com/v1/chat/completions');
});

test('openaiCompatibleAdapter maps json_schema structured output to response_format', () => {
  const schema = { type: 'object', additionalProperties: false, required: [], properties: {} };
  const request = openaiCompatibleAdapter.buildRequest({
    model: 'gpt-4o',
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
  assert.deepEqual(body.response_format, {
    type: 'json_schema',
    json_schema: { name: 'mindmap_overlay', strict: true, schema },
  });
});

test('openaiCompatibleAdapter maps json_object structured output to response_format', () => {
  const request = openaiCompatibleAdapter.buildRequest({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'emit json' }],
    maxTokens: 800,
    temperature: 0.2,
    credentials: { apiKey: 'key' },
    structuredOutput: { kind: 'json_object' },
  });

  const body = JSON.parse(String(request.init.body));
  assert.deepEqual(body.response_format, { type: 'json_object' });
});

test('openaiCompatibleAdapter supports vision-style image_url content blocks', () => {
  const request = openaiCompatibleAdapter.buildRequest({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Read the notes in this image.' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      ],
    }],
    maxTokens: 900,
    temperature: 0.2,
    credentials: { apiKey: 'key' },
  });

  const body = JSON.parse(String(request.init.body));
  assert.deepEqual(body.messages, [{
    role: 'user',
    content: [
      { type: 'text', text: 'Read the notes in this image.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
    ],
  }]);
});

test('openaiCompatibleAdapter.parseResponse extracts assistant content and tolerates empty payloads', () => {
  assert.equal(
    openaiCompatibleAdapter.parseResponse({
      choices: [{ message: { content: '{"dsl":"@root Topic"}' } }],
    }),
    '{"dsl":"@root Topic"}',
  );
  assert.equal(openaiCompatibleAdapter.parseResponse({}), '');
  assert.equal(openaiCompatibleAdapter.parseResponse(undefined), '');
});
