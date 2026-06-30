import assert from 'node:assert/strict';
import test from 'node:test';

import { createUpstashRateLimiterStore } from './upstash-rate-limiter-store.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseOptions = {
  windowMs: 30_000,
  maxRequests: 18,
  url: 'https://db.upstash.io',
  token: 'test-token',
};

test('issues a pipelined INCR/PEXPIRE-NX/PTTL to the Upstash REST endpoint', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const store = createUpstashRateLimiterStore({
    ...baseOptions,
    fetchImpl: (async (input: unknown, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse([{ result: 1 }, { result: 1 }, { result: 29_999 }]);
    }) as unknown as typeof fetch,
  });

  const outcome = await store.consume('203.0.113.7:openai', 0);

  assert.equal(outcome.allowed, true);
  assert.equal(outcome.retryAfterSeconds, 0);
  assert.equal(capturedUrl, 'https://db.upstash.io/pipeline');
  assert.equal((capturedInit?.headers as Record<string, string>).Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), [
    ['INCR', 'mindmap:ratelimit:203.0.113.7:openai'],
    ['PEXPIRE', 'mindmap:ratelimit:203.0.113.7:openai', '30000', 'NX'],
    ['PTTL', 'mindmap:ratelimit:203.0.113.7:openai'],
  ]);
});

test('denies with Retry-After derived from PTTL once the budget is exceeded', async () => {
  const store = createUpstashRateLimiterStore({
    ...baseOptions,
    maxRequests: 3,
    fetchImpl: (async () =>
      jsonResponse([{ result: 4 }, { result: 0 }, { result: 4_200 }])) as unknown as typeof fetch,
  });

  assert.deepEqual(await store.consume('client', 0), { allowed: false, retryAfterSeconds: 5 });
});

test('fails open on a non-2xx response', async () => {
  const store = createUpstashRateLimiterStore({
    ...baseOptions,
    fetchImpl: (async () => jsonResponse({ error: 'unauthorized' }, 401)) as unknown as typeof fetch,
  });

  assert.deepEqual(await store.consume('client', 0), { allowed: true, retryAfterSeconds: 0 });
});

test('fails open when fetch throws', async () => {
  const store = createUpstashRateLimiterStore({
    ...baseOptions,
    fetchImpl: (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch,
  });

  assert.deepEqual(await store.consume('client', 0), { allowed: true, retryAfterSeconds: 0 });
});

test('fails open on a command-level error in the pipeline result', async () => {
  const store = createUpstashRateLimiterStore({
    ...baseOptions,
    fetchImpl: (async () =>
      jsonResponse([{ result: 1 }, { error: 'ERR bad command' }, { result: 1 }])) as unknown as typeof fetch,
  });

  assert.deepEqual(await store.consume('client', 0), { allowed: true, retryAfterSeconds: 0 });
});
