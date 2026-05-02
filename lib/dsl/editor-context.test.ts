import assert from 'node:assert/strict';
import test from 'node:test';

import { getMindmapSectionContext } from './editor-context.ts';

const outline = `@root: Photosynthesis
- @branch: Overview
  - Definition
  - Why it matters
- @branch: Calvin cycle
  - Steps
    - Reduction
      - ATP and NADPH
`;

test('getMindmapSectionContext resolves the active branch and leaf trail', () => {
  const context = getMindmapSectionContext(outline, { lineNumber: 8, column: 22 });

  assert.equal(context.rootLabel, 'Photosynthesis');
  assert.equal(context.branchLabel, 'Calvin cycle');
  assert.deepEqual(context.subBranchTrail, ['Steps', 'Reduction', 'ATP and NADPH']);
  assert.equal(context.currentLineKind, 'leaf');
});

test('getMindmapSectionContext keeps the surrounding branch when the cursor is on a blank line', () => {
  const context = getMindmapSectionContext(`${outline}  `, { lineNumber: 9, column: 3 });

  assert.equal(context.branchLabel, 'Calvin cycle');
  assert.deepEqual(context.subBranchTrail, ['Steps', 'Reduction', 'ATP and NADPH']);
  assert.equal(context.currentLineKind, 'blank');
  assert.equal(context.indentLevel, 1);
});

test('getMindmapSectionContext reads partial labels from the current cursor prefix', () => {
  const context = getMindmapSectionContext(
    `${outline}- @branch: Pig`,
    { lineNumber: 9, column: 14 },
  );

  assert.equal(context.currentLineKind, 'branch');
  assert.equal(context.currentLabelFragment, 'Pi');
});