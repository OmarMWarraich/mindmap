import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLayoutWorkerTimeoutDiagnostics,
  formatLayoutWorkerErrorEvent,
  formatLayoutWorkerMessageErrorEvent,
  layoutWorkerTimeoutMs,
} from './worker-diagnostics.ts';

test('formatLayoutWorkerErrorEvent includes the worker script location when present', () => {
  const event = {
    message: 'Failed to load worker script',
    filename: 'https://example.com/_next/static/chunks/worker.js',
    lineno: 12,
    colno: 8,
  } as ErrorEvent;

  assert.equal(
    formatLayoutWorkerErrorEvent(event),
    'Failed to load worker script at https://example.com/_next/static/chunks/worker.js:12:8',
  );
});

test('formatLayoutWorkerMessageErrorEvent reports the payload shape', () => {
  const event = {
    data: { requestId: 4, result: new Map() },
  } as MessageEvent;

  assert.equal(
    formatLayoutWorkerMessageErrorEvent(event),
    'Worker message could not be deserialized (Object payload).',
  );
});

test('createLayoutWorkerTimeoutDiagnostics preserves the request metadata', () => {
  assert.deepEqual(createLayoutWorkerTimeoutDiagnostics(7, layoutWorkerTimeoutMs), {
    phase: 'timeout',
    summary: `Layout worker timed out after ${layoutWorkerTimeoutMs}ms.`,
    detail: 'The worker accepted the request but never returned a layout result or error.',
    requestId: 7,
    elapsedMs: layoutWorkerTimeoutMs,
  });
});