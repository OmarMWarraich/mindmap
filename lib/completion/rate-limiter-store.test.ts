import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInMemoryRateLimiterStore,
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
