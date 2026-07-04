import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

// Avoid loading the real Neon-backed db module (which the test runner cannot resolve).
mock.module('../../../../lib/db/index.ts', { namedExports: { db: {} } });

mock.module('../../../../auth.ts', {
  namedExports: {
    auth: (handler: (req: Request) => unknown) => (req: Request) => {
      const userId = req.headers.get('x-test-user-id');
      if (userId) {
        (req as Request & { auth?: unknown }).auth = { user: { id: userId } };
      }
      return handler(req);
    },
  },
});

const {
  createInMemoryCompletionTelemetryStore,
  resetCompletionTelemetryStoreForTests,
  setCompletionTelemetryStoreForTests,
} = await import('../../../../lib/completion/telemetry-store.ts');

const { POST } = await import('./route.ts') as unknown as { POST: (req: Request) => Promise<Response> };

function eventRequest(body: unknown, authenticated = true): Request {
  return new Request('http://localhost/api/completion/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { 'x-test-user-id': 'test-user-id' } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validEvent = {
  correlationId: 'completion-1',
  outcome: 'accepted',
  outlineLength: 42,
  requestReason: 'explicit',
  shownDurationMs: 120,
  source: 'model',
  suggestionText: 'ATP synthase',
};

test('completion event route persists accepted events as length, not raw text', async () => {
  const store = createInMemoryCompletionTelemetryStore();
  setCompletionTelemetryStoreForTests(store);

  try {
    const response = await POST(eventRequest(validEvent));

    assert.equal(response.status, 202);
    assert.deepEqual(store.entries(), [
      {
        userId: 'test-user-id',
        correlationId: 'completion-1',
        outcome: 'accepted',
        source: 'model',
        requestReason: 'explicit',
        outlineLength: 42,
        suggestionLength: 12,
        shownDurationMs: 120,
      },
    ]);
  } finally {
    resetCompletionTelemetryStoreForTests();
  }
});

test('completion event route rejects invalid payloads without persisting', async () => {
  const store = createInMemoryCompletionTelemetryStore();
  setCompletionTelemetryStoreForTests(store);

  try {
    const response = await POST(eventRequest({ outcome: 'accepted' }));

    assert.equal(response.status, 400);
    assert.equal(store.entries().length, 0);
  } finally {
    resetCompletionTelemetryStoreForTests();
  }
});

test('completion event route rejects unauthenticated requests', async () => {
  const store = createInMemoryCompletionTelemetryStore();
  setCompletionTelemetryStoreForTests(store);

  try {
    const response = await POST(eventRequest(validEvent, false));

    assert.equal(response.status, 401);
    assert.equal(store.entries().length, 0);
  } finally {
    resetCompletionTelemetryStoreForTests();
  }
});

test('completion event route stays 202 when telemetry persistence fails (best-effort)', async () => {
  setCompletionTelemetryStoreForTests({
    async record() {
      throw new Error('db down');
    },
  });

  try {
    const response = await POST(eventRequest({ ...validEvent, outcome: 'dismissed' }));
    assert.equal(response.status, 202);
  } finally {
    resetCompletionTelemetryStoreForTests();
  }
});
