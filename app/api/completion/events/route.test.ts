import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import {
  getInlineCompletionEventLogForTests,
  resetInlineCompletionEventLogForTests,
} from '../../../../lib/completion/instrumentation.ts';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

mock.module('../../../../auth.ts', {
  namedExports: {
    auth: (handler: Function) => (req: Request) => {
      const userId = req.headers.get('x-test-user-id');
      if (userId) {
        (req as any).auth = { user: { id: userId } };
      }
      return handler(req);
    },
  },
});

const { POST } = await import('./route.ts') as unknown as { POST: (req: Request) => Promise<Response> };

test('completion event route records accepted suggestion events', async () => {
  resetInlineCompletionEventLogForTests();

  const response = await POST(new Request('http://localhost/api/completion/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': 'test-user-id',
    },
    body: JSON.stringify({
      correlationId: 'completion-1',
      outcome: 'accepted',
      outlineLength: 42,
      requestReason: 'explicit',
      shownDurationMs: 120,
      source: 'model',
      suggestionText: 'ATP synthase',
    }),
  }));

  assert.equal(response.status, 202);
  assert.deepEqual(getInlineCompletionEventLogForTests(), [
    {
      correlationId: 'completion-1',
      outcome: 'accepted',
      outlineLength: 42,
      requestReason: 'explicit',
      shownDurationMs: 120,
      source: 'model',
      suggestionText: 'ATP synthase',
    },
  ]);
});

test('completion event route rejects invalid payloads', async () => {
  resetInlineCompletionEventLogForTests();

  const response = await POST(new Request('http://localhost/api/completion/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': 'test-user-id',
    },
    body: JSON.stringify({ outcome: 'accepted' }),
  }));

  assert.equal(response.status, 400);
  assert.equal(getInlineCompletionEventLogForTests().length, 0);
});

test('completion event route rejects unauthenticated requests', async () => {
  resetInlineCompletionEventLogForTests();

  const response = await POST(new Request('http://localhost/api/completion/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correlationId: 'completion-1',
      outcome: 'accepted',
      outlineLength: 42,
      requestReason: 'explicit',
      shownDurationMs: 120,
      source: 'model',
      suggestionText: 'ATP synthase',
    }),
  }));

  assert.equal(response.status, 401);
  assert.equal(getInlineCompletionEventLogForTests().length, 0);
});
