import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

// Avoid loading the real Neon-backed db module (which the test runner cannot resolve).
mock.module('../db/index.ts', { namedExports: { db: {} } });

const {
  createDrizzleCompletionTelemetryStore,
  createInMemoryCompletionTelemetryStore,
  getCompletionTelemetryStore,
  resetCompletionTelemetryStoreForTests,
  setCompletionTelemetryStoreForTests,
} = await import('./telemetry-store.ts');

const sampleEvent = {
  userId: 'u1',
  correlationId: 'c1',
  outcome: 'accepted',
  source: 'model',
  requestReason: 'explicit',
  outlineLength: 42,
  suggestionLength: 12,
  shownDurationMs: 120,
};

test('in-memory telemetry store records and exposes entries', async () => {
  const store = createInMemoryCompletionTelemetryStore();

  await store.record(sampleEvent);
  assert.deepEqual(store.entries(), [sampleEvent]);

  store.clear();
  assert.deepEqual(store.entries(), []);
});

test('setCompletionTelemetryStoreForTests overrides the singleton until reset', () => {
  const store = createInMemoryCompletionTelemetryStore();

  setCompletionTelemetryStoreForTests(store);
  assert.equal(getCompletionTelemetryStore(), store);

  resetCompletionTelemetryStoreForTests();
  assert.notEqual(getCompletionTelemetryStore(), store);

  resetCompletionTelemetryStoreForTests();
});

test('drizzle telemetry store inserts the event row', async () => {
  const inserts: Array<{ value: unknown }> = [];
  const fakeDb = {
    insert: () => ({
      values: async (value: unknown) => {
        inserts.push({ value });
      },
    }),
  };

  const store = createDrizzleCompletionTelemetryStore(
    fakeDb as unknown as Parameters<typeof createDrizzleCompletionTelemetryStore>[0],
  );
  await store.record(sampleEvent);

  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0].value, sampleEvent);
});
