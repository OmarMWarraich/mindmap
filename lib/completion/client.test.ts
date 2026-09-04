import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseInlineCompletionClientResponse,
  requestInlineCompletionFromApi,
  trackInlineCompletionEvent,
} from './client.ts';

test('parseInlineCompletionClientResponse accepts the expected route payload', () => {
  assert.deepEqual(parseInlineCompletionClientResponse({
    completionText: 'ATP synthase',
    source: 'model',
  }), {
    completionText: 'ATP synthase',
    source: 'model',
  });
});

test('parseInlineCompletionClientResponse rejects malformed payloads', () => {
  assert.equal(parseInlineCompletionClientResponse({ completionText: 'ATP synthase' }), null);
  assert.equal(parseInlineCompletionClientResponse(null), null);
});

test('requestInlineCompletionFromApi posts to the completion endpoint', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  const response = await requestInlineCompletionFromApi(
    {
      outline: '@root: Photosynthesis',
      cursor: { lineNumber: 1, column: 5 },
    },
    {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;

        return new Response(JSON.stringify({
          completionText: 'ATP synthase',
          source: 'model',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  );

  assert.deepEqual(response, {
    completionText: 'ATP synthase',
    source: 'model',
  });
  assert.equal(requestUrl, '/api/completion');
  assert.equal(requestInit?.method, 'POST');
});

test('requestInlineCompletionFromApi treats aborted requests as a normal no-op', async () => {
  const response = await requestInlineCompletionFromApi(
    {
      outline: '@root: Photosynthesis',
      cursor: { lineNumber: 1, column: 5 },
    },
    {
      fetchImpl: async () => {
        const error = new DOMException('The operation was aborted.', 'AbortError');
        throw error;
      },
    },
  );

  assert.equal(response, null);
});

test('trackInlineCompletionEvent posts lifecycle events to the instrumentation endpoint', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  await trackInlineCompletionEvent(
    {
      correlationId: 'completion-1',
      outcome: 'ignored',
      outlineLength: 42,
      requestReason: 'automatic',
      shownDurationMs: 90,
      source: 'model',
      suggestionText: 'ATP synthase',
    },
    {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;

        return new Response(null, { status: 202 });
      },
    },
  );

  assert.equal(requestUrl, '/api/completion/events');
  assert.equal(requestInit?.method, 'POST');
});