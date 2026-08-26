import assert from 'node:assert/strict';
import test from 'node:test';

import { toggleMindmapDslInlineFormatting } from './inline-formatting.ts';

test('wraps a selection in bold markers', () => {
  assert.equal(toggleMindmapDslInlineFormatting('Krebs cycle', 'bold'), '**Krebs cycle**');
});

test('wraps a selection in italic markers', () => {
  assert.equal(toggleMindmapDslInlineFormatting('ATP yield', 'italic'), '_ATP yield_');
});

test('wraps a selection in underline markers', () => {
  assert.equal(
    toggleMindmapDslInlineFormatting('electron chain', 'underline'),
    '<u>electron chain</u>',
  );
});

test('unwraps a selection that already carries the format markers', () => {
  assert.equal(toggleMindmapDslInlineFormatting('**Krebs cycle**', 'bold'), 'Krebs cycle');
  assert.equal(toggleMindmapDslInlineFormatting('_ATP yield_', 'italic'), 'ATP yield');
  assert.equal(
    toggleMindmapDslInlineFormatting('<u>electron chain</u>', 'underline'),
    'electron chain',
  );
});

test('empty selection produces an empty marker pair for caret placement', () => {
  assert.equal(toggleMindmapDslInlineFormatting('', 'bold'), '****');
  assert.equal(toggleMindmapDslInlineFormatting('', 'italic'), '__');
  assert.equal(toggleMindmapDslInlineFormatting('', 'underline'), '<u></u>');
});

test('single marker character selection is wrapped rather than unwrapped', () => {
  assert.equal(toggleMindmapDslInlineFormatting('_', 'italic'), '___');
});
