import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeInlineCompletionRateLimit,
  createInlineCompletionCacheKey,
  getCachedInlineCompletion,
  getInlineCompletionClientKey,
  getInlineCompletionProvider,
  getInlineCompletionRateLimitKey,
  resetInlineCompletionRuntimeControlsForTests,
  setCachedInlineCompletion,
} from './runtime-controls.ts';

test('createInlineCompletionCacheKey is stable for identical requests', () => {
  assert.equal(
    createInlineCompletionCacheKey({
      outline: '@root: Topic',
      cursor: { lineNumber: 1, column: 5 },
    }),
    createInlineCompletionCacheKey({
      outline: '@root: Topic',
      cursor: { lineNumber: 1, column: 5 },
    }),
  );
});

test('createInlineCompletionCacheKey differs across models for identical context', () => {
  const base = { outline: '@root: Topic', cursor: { lineNumber: 1, column: 5 } } as const;

  assert.notEqual(
    createInlineCompletionCacheKey({ ...base, modelId: 'gpt-5.4' }),
    createInlineCompletionCacheKey({ ...base, modelId: 'claude-haiku-4-5' }),
  );
});

test('createInlineCompletionCacheKey treats an omitted modelId as the completion default', () => {
  const base = { outline: '@root: Topic', cursor: { lineNumber: 1, column: 5 } } as const;

  assert.equal(
    createInlineCompletionCacheKey(base),
    createInlineCompletionCacheKey({ ...base, modelId: 'claude-haiku-4-5' }),
  );
});

test('cache helpers return cached responses until the ttl expires', () => {
  resetInlineCompletionRuntimeControlsForTests();
  const cacheKey = 'completion-key';

  setCachedInlineCompletion(cacheKey, { completionText: 'ynthase', source: 'model' }, 1_000);

  assert.deepEqual(getCachedInlineCompletion(cacheKey, 5_000), {
    completionText: 'ynthase',
    source: 'model',
  });
  assert.equal(getCachedInlineCompletion(cacheKey, 20_000), null);
});

test('rate-limit helper rejects burst traffic after the configured window budget', async () => {
  resetInlineCompletionRuntimeControlsForTests();

  for (let attempt = 0; attempt < 18; attempt += 1) {
    assert.deepEqual(await consumeInlineCompletionRateLimit('client-1', 1_000), {
      allowed: true,
      retryAfterSeconds: 0,
    });
  }

  assert.deepEqual(await consumeInlineCompletionRateLimit('client-1', 1_000), {
    allowed: false,
    retryAfterSeconds: 30,
  });
});

test('getInlineCompletionClientKey prefers forwarded client ip headers', () => {
  assert.equal(
    getInlineCompletionClientKey(new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.1' },
    })),
    '203.0.113.1',
  );
});

test('getInlineCompletionProvider resolves the effective completion model provider', () => {
  const base = { outline: '@root: Topic', cursor: { lineNumber: 1, column: 5 } } as const;

  assert.equal(getInlineCompletionProvider({ ...base, modelId: 'gpt-5.4' }), 'openai');
  assert.equal(getInlineCompletionProvider({ ...base, modelId: 'claude-haiku-4-5' }), 'anthropic');
  // An omitted modelId falls back to the completion-role default (an Anthropic model).
  assert.equal(getInlineCompletionProvider(base), 'anthropic');
});

test('getInlineCompletionRateLimitKey scopes the client window to the provider', () => {
  const httpRequest = new Request('http://localhost', {
    headers: { 'x-forwarded-for': '203.0.113.7' },
  });
  const base = { outline: '@root: Topic', cursor: { lineNumber: 1, column: 5 } } as const;

  assert.equal(
    getInlineCompletionRateLimitKey(httpRequest, { ...base, modelId: 'gpt-5.4' }),
    '203.0.113.7:openai',
  );
  assert.equal(
    getInlineCompletionRateLimitKey(httpRequest, { ...base, modelId: 'claude-haiku-4-5' }),
    '203.0.113.7:anthropic',
  );
});

test('per-provider rate-limit keys keep one provider from starving another', async () => {
  resetInlineCompletionRuntimeControlsForTests();
  const httpRequest = new Request('http://localhost', {
    headers: { 'x-forwarded-for': '203.0.113.9' },
  });
  const base = { outline: '@root: Topic', cursor: { lineNumber: 1, column: 5 } } as const;
  const openaiKey = getInlineCompletionRateLimitKey(httpRequest, { ...base, modelId: 'gpt-5.4' });
  const anthropicKey = getInlineCompletionRateLimitKey(httpRequest, { ...base, modelId: 'claude-haiku-4-5' });

  // Exhaust the OpenAI budget for this client.
  for (let attempt = 0; attempt < 18; attempt += 1) {
    assert.equal((await consumeInlineCompletionRateLimit(openaiKey, 1_000)).allowed, true);
  }
  assert.equal((await consumeInlineCompletionRateLimit(openaiKey, 1_000)).allowed, false);

  // The Anthropic budget for the same client is untouched.
  assert.deepEqual(await consumeInlineCompletionRateLimit(anthropicKey, 1_000), {
    allowed: true,
    retryAfterSeconds: 0,
  });
});