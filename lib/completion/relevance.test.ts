import assert from 'node:assert/strict';
import test from 'node:test';

import { extractInlineCompletionContextWindow } from './context.ts';
import { evaluateInlineCompletionRelevance } from './relevance.ts';

function createContext() {
  return extractInlineCompletionContextWindow(
    '@root: Photosynthesis\n- @branch: Light reactions\n  - ATP synthase',
    { lineNumber: 3, column: 10 },
  );
}

test('evaluateInlineCompletionRelevance rejects empty completions', () => {
  assert.deepEqual(evaluateInlineCompletionRelevance('', createContext()), {
    accepted: false,
    reason: 'empty',
  });
});

test('evaluateInlineCompletionRelevance rejects repetitive completions already present in nearby text', () => {
  assert.deepEqual(evaluateInlineCompletionRelevance('ATP synthase', createContext()), {
    accepted: false,
    reason: 'repetitive',
  });
});

test('evaluateInlineCompletionRelevance rejects overly broad filler completions', () => {
  assert.deepEqual(evaluateInlineCompletionRelevance('important details', createContext()), {
    accepted: false,
    reason: 'overly-broad',
  });
});

test('evaluateInlineCompletionRelevance rejects off-topic completions with no topical overlap', () => {
  assert.deepEqual(evaluateInlineCompletionRelevance('French Revolution causes', createContext()), {
    accepted: false,
    reason: 'off-topic',
  });
});

test('evaluateInlineCompletionRelevance accepts topical study additions', () => {
  assert.deepEqual(evaluateInlineCompletionRelevance('proton gradient', createContext()), {
    accepted: true,
    reason: null,
  });
});

test('evaluateInlineCompletionRelevance accepts short continuation suffixes', () => {
  assert.deepEqual(evaluateInlineCompletionRelevance('ase', createContext()), {
    accepted: true,
    reason: null,
  });
});