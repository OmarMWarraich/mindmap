import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInlineCompletionEventLogForTests,
  resetInlineCompletionEventLogForTests,
} from '../../../../lib/completion/instrumentation.ts';
import { POST } from './route.ts';

test('completion event route records accepted suggestion events', async () => {
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'accepted' }),
  }));

  assert.equal(response.status, 400);
  assert.equal(getInlineCompletionEventLogForTests().length, 0);
});