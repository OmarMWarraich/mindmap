import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectNearbySiblingLabels,
  rejectDuplicateSiblingCompletion,
} from './sibling-check.ts';

const outline = [
  '@root: Photosynthesis',
  '- @branch: Light reactions',
  '  - ATP synthase',
  '  - proton gradient',
  '  - NADPH output',
  '- @branch: Calvin cycle',
  '  - carbon fixation',
].join('\n');

test('collectNearbySiblingLabels returns sibling labels from the current local block', () => {
  assert.deepEqual(
    collectNearbySiblingLabels(outline, { lineNumber: 4, column: 8 }),
    ['ATP synthase', 'NADPH output'],
  );
});

test('rejectDuplicateSiblingCompletion rejects completions that match a nearby sibling label', () => {
  assert.deepEqual(
    rejectDuplicateSiblingCompletion('NADPH output', outline, { lineNumber: 3, column: 10 }),
    {
      accepted: false,
      siblingLabels: ['proton gradient', 'NADPH output'],
    },
  );
});

test('rejectDuplicateSiblingCompletion allows novel enrichment beside nearby siblings', () => {
  assert.deepEqual(
    rejectDuplicateSiblingCompletion('thylakoid lumen acidification', outline, { lineNumber: 3, column: 10 }),
    {
      accepted: true,
      siblingLabels: ['proton gradient', 'NADPH output'],
    },
  );
});