import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInlineCompletionEventLogForTests,
  recordInlineCompletionEvent,
  resetInlineCompletionEventLogForTests,
} from './instrumentation.ts';

test('recordInlineCompletionEvent stores completion lifecycle events', () => {
  resetInlineCompletionEventLogForTests();

  recordInlineCompletionEvent({
    correlationId: 'completion-1',
    outcome: 'accepted',
    outlineLength: 42,
    requestReason: 'explicit',
    shownDurationMs: 120,
    source: 'model',
    suggestionText: 'ATP synthase',
  });

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