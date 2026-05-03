import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';
import {
  buildSvgPreviewModel,
  clampSvgPreviewScale,
  createDefaultSvgPreviewTransform,
  createEdgePath,
  panSvgPreviewTransform,
  wrapMindmapLabel,
  zoomSvgPreviewAroundPoint,
} from './svg-preview.ts';

test('wrapMindmapLabel splits long labels into multiple lines', () => {
  assert.deepEqual(wrapMindmapLabel('Cellular respiration drives ATP output', 18), [
    'Cellular',
    'respiration drives',
    'ATP output',
  ]);
});

test('createEdgePath converts routed points into an SVG path', () => {
  assert.equal(
    createEdgePath([
      { x: 10, y: 20 },
      { x: 40, y: 60 },
      { x: 70, y: 90 },
    ]),
    'M 10 20 L 40 60 L 70 90',
  );
});

test('buildSvgPreviewModel combines layout coordinates with node styling', () => {
  const model = buildSvgPreviewModel(validGeneratedMindmapFixture, {
    width: 900,
    height: 700,
    nodes: validGeneratedMindmapFixture.nodes.slice(0, 3).map((node, index) => ({
      id: node.id,
      x: 80 + index * 220,
      y: 120 + index * 90,
      width: node.layout.minWidth,
      height: node.layout.minHeight,
    })),
    edges: [
      {
        id: validGeneratedMindmapFixture.edges[0].id,
        points: [
          { x: 160, y: 160 },
          { x: 260, y: 180 },
          { x: 360, y: 240 },
        ],
      },
    ],
  });

  assert.equal(model.width, 900);
  assert.equal(model.height, 700);
  assert.equal(model.nodes.length, 3);
  assert.equal(model.edges.length, 1);
  assert.equal(model.nodes[1]?.style.stroke, '#d97706');
  assert.equal(model.edges[0]?.color, '#fb923c');
  assert.ok(model.nodes[0]?.lines.length >= 1);
});

test('zoomSvgPreviewAroundPoint preserves the anchor position while scaling', () => {
  const transform = zoomSvgPreviewAroundPoint(
    createDefaultSvgPreviewTransform(),
    1.5,
    { x: 300, y: 240 },
  );

  assert.deepEqual(transform, {
    scale: 1.5,
    translateX: -150,
    translateY: -120,
  });
});

test('panSvgPreviewTransform offsets the current translation', () => {
  assert.deepEqual(
    panSvgPreviewTransform(
      { scale: 1.2, translateX: 10, translateY: -20 },
      { x: 18, y: 12 },
    ),
    { scale: 1.2, translateX: 28, translateY: -8 },
  );
});

test('clampSvgPreviewScale constrains zoom extremes', () => {
  assert.equal(clampSvgPreviewScale(0.2), 0.55);
  assert.equal(clampSvgPreviewScale(1.4), 1.4);
  assert.equal(clampSvgPreviewScale(4), 2.4);
});