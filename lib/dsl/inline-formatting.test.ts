import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseMindmapInlineSegments,
  stripMindmapInlineFormatting,
  toggleMindmapDslInlineFormatting,
} from './inline-formatting.ts';

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

test('parseMindmapInlineSegments returns one plain segment for unmarked text', () => {
  assert.deepEqual(parseMindmapInlineSegments('Krebs cycle'), [
    { text: 'Krebs cycle', bold: false, italic: false, underline: false },
  ]);
});

test('parseMindmapInlineSegments splits marked text into styled segments', () => {
  assert.deepEqual(parseMindmapInlineSegments('**Krebs** _cycle_ <u>loop</u>'), [
    { text: 'Krebs', bold: true, italic: false, underline: false },
    { text: ' ', bold: false, italic: false, underline: false },
    { text: 'cycle', bold: false, italic: true, underline: false },
    { text: ' ', bold: false, italic: false, underline: false },
    { text: 'loop', bold: false, italic: false, underline: true },
  ]);
});

test('parseMindmapInlineSegments combines flags for nested markers', () => {
  assert.deepEqual(parseMindmapInlineSegments('**bold _both_**'), [
    { text: 'bold ', bold: true, italic: false, underline: false },
    { text: 'both', bold: true, italic: true, underline: false },
  ]);
});

test('parseMindmapInlineSegments keeps unmatched markers as literal text', () => {
  assert.deepEqual(parseMindmapInlineSegments('**alpha'), [
    { text: '**alpha', bold: false, italic: false, underline: false },
  ]);
});

test('stripMindmapInlineFormatting removes all format markers', () => {
  assert.equal(
    stripMindmapInlineFormatting('**Krebs** _cycle_ <u>loop</u>'),
    'Krebs cycle loop',
  );
  assert.equal(stripMindmapInlineFormatting('****'), '');
});
