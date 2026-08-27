import assert from 'node:assert/strict';
import test from 'node:test';

import { isIgnorableMonacoCancellation } from './monaco-cancellation.ts';

test('isIgnorableMonacoCancellation accepts Monaco canceled errors with prefixed messages', () => {
  assert.equal(
    isIgnorableMonacoCancellation({
      name: 'Canceled',
      message: 'Canceled: Canceled',
      stack: 'at https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:7:10848',
    }),
    true,
  );
});

test('isIgnorableMonacoCancellation accepts Monaco canceled errors with exact messages', () => {
  assert.equal(
    isIgnorableMonacoCancellation({
      message: 'Canceled',
      stack: 'monaco-editor/min/vs/editor.api-CalNCsUg.js',
    }),
    true,
  );
});

test('isIgnorableMonacoCancellation accepts browser AbortError cancellations', () => {
  assert.equal(
    isIgnorableMonacoCancellation({
      name: 'AbortError',
      message: 'The operation was aborted.',
      stack: 'at fetch (<anonymous>)',
    }),
    true,
  );
});

test('isIgnorableMonacoCancellation accepts generic aborted request messages', () => {
  assert.equal(
    isIgnorableMonacoCancellation({
      name: 'Error',
      message: 'signal is aborted',
      stack: 'at app.js:10:2',
    }),
    true,
  );
});

test('isIgnorableMonacoCancellation rejects unrelated errors', () => {
  assert.equal(
    isIgnorableMonacoCancellation({
      name: 'TypeError',
      message: 'Cannot read properties of undefined',
      stack: 'at app.js:10:2',
    }),
    false,
  );
});