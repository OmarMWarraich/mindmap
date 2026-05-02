import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeInlineCompletionOutput,
  stripCurrentLinePrefix,
  stripPresentationWrappers,
} from './normalize.ts';

test('stripPresentationWrappers removes code fences and surrounding quotes', () => {
  assert.equal(stripPresentationWrappers('```text\n  - proton gradient\n```'), '  - proton gradient');
  assert.equal(stripPresentationWrappers('"  - ATP synthase"'), '  - ATP synthase');
});

test('stripCurrentLinePrefix removes duplicated current-line text from the completion', () => {
  assert.equal(stripCurrentLinePrefix('  - ATP synthase', '  - ATP s'), 'ynthase');
  assert.equal(stripCurrentLinePrefix('ATP synthase', '  - ATP s'), 'ynthase');
});

test('normalizeInlineCompletionOutput returns insertion-only text for ghost text rendering', () => {
  assert.equal(
    normalizeInlineCompletionOutput('```\n  - ATP synthase<CURSOR>\n```', {
      currentLinePrefix: '  - ATP s',
    }),
    'ynthase',
  );
});

test('normalizeInlineCompletionOutput preserves multiline insertions while trimming trailing shell whitespace', () => {
  assert.equal(
    normalizeInlineCompletionOutput('\n  - proton gradient  \n  - ATP synthase  ', {
      currentLinePrefix: '',
    }),
    '\n  - proton gradient\n  - ATP synthase',
  );
});