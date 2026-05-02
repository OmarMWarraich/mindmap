import assert from 'node:assert/strict';
import test from 'node:test';

import { getMindmapSectionContext } from './editor-context.ts';
import {
  getStubInlineSuggestionSet,
  pickPreferredStubSuggestion,
} from './inline-completion.ts';

test('stub inline completions can start a blank outline with a root marker', () => {
  const suggestions = getStubInlineSuggestionSet(
    getMindmapSectionContext('', { lineNumber: 1, column: 1 }),
  );

  assert.equal(suggestions.continuation?.insertText, '@root: Topic');
  assert.equal(suggestions.enrichment, null);
});

test('stub inline completions finish a partial branch marker', () => {
  const suggestions = getStubInlineSuggestionSet(
    getMindmapSectionContext('@root: Topic\n- @b', { lineNumber: 2, column: 5 }),
  );

  assert.equal(suggestions.continuation?.insertText, 'ranch: Key idea');
});

test('stub inline completions offer the next detail after a branch line', () => {
  const suggestions = getStubInlineSuggestionSet(
    getMindmapSectionContext('@root: Topic\n- @branch: Overview', { lineNumber: 2, column: 20 }),
  );
  const preferred = pickPreferredStubSuggestion(suggestions);

  assert.equal(preferred?.kind, 'continuation');
  assert.equal(suggestions.enrichment?.insertText, '\n  - Key detail');
});