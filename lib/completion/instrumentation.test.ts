import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

// Avoid loading the real Neon-backed db module (which the test runner cannot resolve).
mock.module('../db/index.ts', { namedExports: { db: {} } });

const { recordInlineCompletionEvent } = await import('./instrumentation.ts');
const {
  createInMemoryCompletionTelemetryStore,
  resetCompletionTelemetryStoreForTests,
  setCompletionTelemetryStoreForTests,
} = await import('./telemetry-store.ts');

test('recordInlineCompletionEvent persists length, not the raw suggestion text', async () => {
  const store = createInMemoryCompletionTelemetryStore();
  setCompletionTelemetryStoreForTests(store);

  try {
    await recordInlineCompletionEvent(
      {
        correlationId: 'completion-1',
        outcome: 'accepted',
        outlineLength: 42,
        requestReason: 'explicit',
        shownDurationMs: 120.6,
        source: 'model',
        suggestionText: 'ATP synthase',
      },
      'user-1',
    );

    assert.deepEqual(store.entries(), [
      {
        userId: 'user-1',
        correlationId: 'completion-1',
        outcome: 'accepted',
        source: 'model',
        requestReason: 'explicit',
        outlineLength: 42,
        suggestionLength: 12,
        shownDurationMs: 121,
      },
    ]);
  } finally {
    resetCompletionTelemetryStoreForTests();
  }
});
