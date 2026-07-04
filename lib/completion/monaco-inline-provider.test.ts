import assert from 'node:assert/strict';
import test from 'node:test';

import type { Monaco } from '@monaco-editor/react';

import { createMindmapDslInlineCompletionsProvider } from './monaco-inline-provider.ts';

test('createMindmapDslInlineCompletionsProvider exposes the legacy Monaco disposal hook', () => {
  const provider = createMindmapDslInlineCompletionsProvider(
    createTestMonaco(),
    async () => null,
    async () => undefined,
  );

  assert.equal(typeof provider.disposeInlineCompletions, 'function');
  assert.doesNotThrow(() => {
    provider.disposeInlineCompletions({ items: [] }, { kind: 'other' });
  });
});

test('createMindmapDslInlineCompletionsProvider tracks accepted completions at end of lifetime', async () => {
  const trackedEvents: Array<{ outcome: string; suggestionText: string }> = [];
  const provider = createMindmapDslInlineCompletionsProvider(
    createTestMonaco(),
    async () => null,
    async (event) => {
      trackedEvents.push({ outcome: event.outcome, suggestionText: event.suggestionText });
    },
  );

  provider.handleEndOfLifetime?.(
    { items: [] },
    { correlationId: 'completion-1', insertText: ' - key detail' },
    { kind: 0 },
    {
      characterCountOriginal: 42,
      requestReason: 'automatic',
      shownDuration: 120,
    } as never,
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(trackedEvents, [{ outcome: 'accepted', suggestionText: ' - key detail' }]);
});

function createTestMonaco(): Monaco {
  return {
    languages: {
      InlineCompletionEndOfLifeReasonKind: {
        Accepted: 0,
        Rejected: 1,
        Ignored: 2,
      },
    },
  } as Monaco;
}