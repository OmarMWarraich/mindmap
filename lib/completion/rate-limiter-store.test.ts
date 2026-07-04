import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInMemoryRateLimiterStore,
  createRateLimiterStore,
  getRateLimiterStore,
  resetRateLimiterStoreForTests,
} from './rate-limiter-store.ts';

test('in-memory store allows up to the budget then denies within the window', async () => {
  const store = createInMemoryRateLimiterStore({ windowMs: 30_000, maxRequests: 3 });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.deepEqual(await store.consume('client', 1_000), { allowed: true, retryAfterSeconds: 0 });
  }

  assert.deepEqual(await store.consume('client', 1_000), { allowed: false, retryAfterSeconds: 30 });
});

test('in-memory store starts a fresh window once the previous one elapses', async () => {
  const store = createInMemoryRateLimiterStore({ windowMs: 30_000, maxRequests: 1 });

  assert.equal((await store.consume('client', 1_000)).allowed, true);
  assert.equal((await store.consume('client', 1_000)).allowed, false);
  // After the window elapses the budget resets.
  assert.equal((await store.consume('client', 40_000)).allowed, true);
});

test('in-memory store scopes budgets independently per key', async () => {
  const store = createInMemoryRateLimiterStore({ windowMs: 30_000, maxRequests: 1 });

  assert.equal((await store.consume('a', 1_000)).allowed, true);
  assert.equal((await store.consume('a', 1_000)).allowed, false);
  assert.equal((await store.consume('b', 1_000)).allowed, true);
});

test('getRateLimiterStore returns a usable singleton and reset rebuilds it', async () => {
  resetRateLimiterStoreForTests();

  const store = getRateLimiterStore();
  assert.equal(store, getRateLimiterStore());
  assert.equal((await store.consume('client', 1_000)).allowed, true);

  resetRateLimiterStoreForTests();
  assert.notEqual(store, getRateLimiterStore());

  resetRateLimiterStoreForTests();
});

test('createRateLimiterStore uses the in-memory adapter when no Upstash env is set', async () => {
  const store = createRateLimiterStore({ windowMs: 30_000, maxRequests: 1 }, {});

  assert.equal((await store.consume('client', 1_000)).allowed, true);
  assert.equal((await store.consume('client', 1_000)).allowed, false);
});

test('createRateLimiterStore throws on partial Upstash configuration', () => {
  assert.throws(
    () =>
      createRateLimiterStore(
        { windowMs: 30_000, maxRequests: 1 },
        { UPSTASH_REDIS_REST_URL: 'https://db.upstash.io' },
      ),
    /Incomplete Upstash configuration/,
  );
  assert.throws(
    () =>
      createRateLimiterStore(
        { windowMs: 30_000, maxRequests: 1 },
        { UPSTASH_REDIS_REST_TOKEN: 'tok' },
      ),
    /Incomplete Upstash configuration/,
  );
});

test('createRateLimiterStore selects the Upstash adapter when both vars are set', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    calls.push(String(input));
    return new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 29_999 }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  try {
    const store = createRateLimiterStore(
      { windowMs: 30_000, maxRequests: 18 },
      { UPSTASH_REDIS_REST_URL: 'https://db.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 'tok' },
    );

    assert.equal((await store.consume('client', 1_000)).allowed, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'https://db.upstash.io/pipeline');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
