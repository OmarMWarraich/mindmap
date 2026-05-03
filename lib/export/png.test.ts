import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculatePngExportDimensions,
  createPngFileName,
} from './png.ts';

test('calculatePngExportDimensions keeps small exports at full size', () => {
  assert.deepEqual(calculatePngExportDimensions(1200, 800), {
    sourceWidth: 1200,
    sourceHeight: 800,
    outputWidth: 1200,
    outputHeight: 800,
    scale: 1,
    wasClamped: false,
  });
});

test('calculatePngExportDimensions clamps oversized exports by edge and area', () => {
  const dimensions = calculatePngExportDimensions(9000, 6000);

  assert.equal(dimensions.outputWidth <= 4096, true);
  assert.equal(dimensions.outputHeight <= 4096, true);
  assert.equal(dimensions.outputWidth * dimensions.outputHeight <= 16_777_216, true);
  assert.equal(dimensions.wasClamped, true);
});

test('createPngFileName normalizes labels into stable png names', () => {
  assert.equal(createPngFileName('Calvin Cycle / ATP + NADPH'), 'calvin-cycle-atp-nadph.png');
  assert.equal(createPngFileName(''), 'mindmap.png');
});