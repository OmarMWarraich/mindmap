import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractInlineCompletionContextWindow,
  formatStructuralContext,
  getRecentTextWindow,
  insertCursorMarker,
} from './context.ts';

test('getRecentTextWindow keeps the full outline when it fits the token budget', () => {
  assert.equal(getRecentTextWindow('@root: Topic\n- @branch: Overview', 20), '@root: Topic\n- @branch: Overview');
});

test('getRecentTextWindow trims to the most recent tokens when the outline is long', () => {
  assert.equal(
    getRecentTextWindow('one two three four five six', 3),
    'four five six',
  );
});

test('insertCursorMarker inserts a visible cursor marker at the active column', () => {
  assert.equal(insertCursorMarker('  - ATP synth', 10), '  - ATP s<CURSOR>ynth');
});

test('formatStructuralContext renders the current branch and sub-branch state', () => {
  assert.equal(
    formatStructuralContext({
      cursor: { lineNumber: 3, column: 8 },
      currentLine: '  - ATP synth',
      currentLinePrefix: '  - ATP s',
      currentLineKind: 'leaf',
      currentLabelFragment: 'ATP s',
      indentLevel: 1,
      rootLabel: 'Photosynthesis',
      branchLabel: 'Light reactions',
      subBranchTrail: ['ATP and NADPH'],
    }),
    'Root: Photosynthesis\nBranch: Light reactions\nSub-branch: ATP and NADPH\nLine kind: leaf\nIndent level: 1',
  );
});

test('extractInlineCompletionContextWindow returns recent text, line prefix, cursor marker, and section context', () => {
  const outline = [
    '@root: Photosynthesis',
    '- @branch: Light reactions',
    '  - ATP synth',
  ].join('\n');

  const context = extractInlineCompletionContextWindow(outline, { lineNumber: 3, column: 10 }, {
    recentTokenBudget: 8,
  });

  assert.equal(context.recentText, 'Photosynthesis - @branch: Light reactions - ATP synth');
  assert.equal(context.linePrefix, '  - ATP s');
  assert.equal(context.cursor.lineNumber, 3);
  assert.equal(context.currentLineWithCursor, '  - ATP s<CURSOR>ynth');
  assert.match(context.currentBranchAndSubbranch, /Branch: Light reactions/);
  assert.equal(context.section.currentLineKind, 'leaf');
});