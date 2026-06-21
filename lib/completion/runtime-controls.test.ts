import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeInlineCompletionRateLimit,
  createInlineCompletionCacheKey,
  getCachedInlineCompletion,
  getInlineCompletionClientKey,
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
    createInlineCompletionCacheKey({ ...base, modelId: 'gpt-4o-mini' }),
    createInlineCompletionCacheKey({ ...base, modelId: 'claude-haiku-4-5' }),
  );
});

test('createInlineCompletionCacheKey treats an omitted modelId as the completion default', () => {
  const base = { outline: '@root: Topic', cursor: { lineNumber: 1, column: 5 } } as const;

  assert.equal(
    createInlineCompletionCacheKey(base),
    createInlineCompletionCacheKey({ ...base, modelId: 'gpt-4o-mini' }),
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

test('rate-limit helper rejects burst traffic after the configured window budget', () => {
  resetInlineCompletionRuntimeControlsForTests();

  for (let attempt = 0; attempt < 18; attempt += 1) {
    assert.deepEqual(consumeInlineCompletionRateLimit('client-1', 1_000), {
      allowed: true,
      retryAfterSeconds: 0,
    });
  }

  assert.deepEqual(consumeInlineCompletionRateLimit('client-1', 1_000), {
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