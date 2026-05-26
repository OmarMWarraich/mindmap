import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';
import {
  buildSvgPreviewModel,
  clampSvgPreviewScale,
  createDefaultSvgPreviewTransform,
  createEdgePath,
  getSvgPreviewRenderMetrics,
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

test('wrapMindmapLabel keeps all wrapped lines for long labels', () => {
  assert.deepEqual(
    wrapMindmapLabel('one two three four five six seven eight nine ten', 8),
    ['one two', 'three', 'four', 'five six', 'seven', 'eight', 'nine ten'],
  );
});

test('wrapMindmapLabel splits long hyphenated tokens without dropping content', () => {
  assert.deepEqual(
    wrapMindmapLabel('Jean-Jacques Rousseau legitimacy-based consent', 10),
    ['Jean-', 'Jacques', 'Rousseau', 'legitimacy', '-based', 'consent'],
  );
});

test('createEdgePath converts routed points into an SVG path', () => {
  assert.equal(
    createEdgePath([
      { x: 10, y: 20 },
      { x: 40, y: 60 },
      { x: 70, y: 90 },
    ]),
    'M 10 20 Q 40 60 55 75 Q 40 60 70 90',
  );
});

test('createEdgePath curves direct edges with a control point', () => {
  assert.equal(
    createEdgePath([
      { x: 10, y: 20 },
      { x: 90, y: 20 },
    ]),
    'M 10 20 Q 50 52 90 20',
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
  assert.equal(model.nodes[1]?.style.text, '#111827');
  assert.equal(model.edges[0]?.color, '#fb923c');
  assert.ok(model.nodes[0]?.lines.length >= 1);
});

test('buildSvgPreviewModel shifts negative layout coordinates into the export canvas', () => {
  const rootNode = validGeneratedMindmapFixture.nodes[0]!;
  const branchNode = validGeneratedMindmapFixture.nodes[1]!;
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [rootNode, branchNode],
      edges: [validGeneratedMindmapFixture.edges[0]!],
    },
    {
      width: 300,
      height: 220,
      nodes: [
        {
          id: rootNode.id,
          x: -42,
          y: -18,
          width: 248,
          height: 96,
        },
        {
          id: branchNode.id,
          x: 190,
          y: 70,
          width: 220,
          height: 104,
        },
      ],
      edges: [
        {
          id: validGeneratedMindmapFixture.edges[0]!.id,
          points: [
            { x: -30, y: 20 },
            { x: 90, y: -12 },
            { x: 210, y: 110 },
          ],
        },
      ],
    },
    {
      profile: 'export',
      canvasPadding: 12,
    },
  );

  assert.equal(model.width, 476);
  assert.equal(model.height, 262);
  assert.equal(model.nodes[0]!.x, 12);
  assert.equal(model.nodes[0]!.y, 12);
  assert.equal(model.nodes[1]!.x, 244);
  assert.equal(model.nodes[1]!.y, 100);
  assert.equal(model.edges[0]!.path.startsWith('M 24 50'), true);
});

test('buildSvgPreviewModel wraps export text more aggressively when render scale increases', () => {
  const node = validGeneratedMindmapFixture.nodes[1]!;
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [{
        ...node,
        label: 'one two three four five six seven eight nine ten',
      }],
      edges: [],
    },
    {
      width: 400,
      height: 300,
      nodes: [{
        id: node.id,
        x: 40,
        y: 50,
        width: 220,
        height: 180,
      }],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 1.5,
    },
  );

  assert.equal(model.nodes[0]!.lines.length >= 4, true);
});

test('buildSvgPreviewModel keeps export text close to the shared target size for larger boxes', () => {
  const node = validGeneratedMindmapFixture.nodes[1]!;
  const metrics = getSvgPreviewRenderMetrics('export', { scale: 1.4 });
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [{
        ...node,
        label: 'Readable export text should use more of the larger node box on printed A4 output',
      }],
      edges: [],
    },
    {
      width: 520,
      height: 360,
      nodes: [{
        id: node.id,
        x: 40,
        y: 50,
        width: 340,
        height: 260,
      }],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 1.4,
    },
  );

  assert.equal(model.nodes[0]!.fontSize <= metrics.nodeFontSize, true);
  assert.equal(model.nodes[0]!.fontSize >= metrics.nodeFontSize * 0.75, true);
  assert.equal(model.nodes[0]!.lineHeight >= metrics.lineHeight * 0.85, true);
});

test('buildSvgPreviewModel keeps a single export branch line at the base size when vertical space fits', () => {
  const node = validGeneratedMindmapFixture.nodes[1]!;
  const metrics = getSvgPreviewRenderMetrics('export', { scale: 1.4 });
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [{
        ...node,
        label: 'Overview',
      }],
      edges: [],
    },
    {
      width: 420,
      height: 240,
      nodes: [{
        id: node.id,
        x: 40,
        y: 50,
        width: 260,
        height: 120,
      }],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 1.4,
    },
  );

  assert.deepEqual(model.nodes[0]!.lines, ['Overview']);
  assert.equal(model.nodes[0]!.fontSize, metrics.nodeFontSize);
});

test('buildSvgPreviewModel keeps export text size consistent across equally fitting branch nodes', () => {
  const [firstNode, secondNode] = validGeneratedMindmapFixture.nodes.filter((node) => node.kind === 'branch');
  const metrics = getSvgPreviewRenderMetrics('export', { scale: 1.3 });
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [
        { ...firstNode!, label: 'Foundations of constitutional law and state power' },
        { ...secondNode!, label: 'Comparative systems of precedent legislation and codification' },
      ],
      edges: [],
    },
    {
      width: 640,
      height: 320,
      nodes: [
        {
          id: firstNode!.id,
          x: 40,
          y: 50,
          width: 300,
          height: 220,
        },
        {
          id: secondNode!.id,
          x: 360,
          y: 50,
          width: 300,
          height: 220,
        },
      ],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 1.3,
    },
  );

  assert.equal(model.nodes[0]!.fontSize, model.nodes[1]!.fontSize);
  assert.equal(model.nodes[0]!.fontSize <= metrics.nodeFontSize, true);
});

test('buildSvgPreviewModel keeps branch export text larger than tighter leaf export text', () => {
  const branchNode = validGeneratedMindmapFixture.nodes.find((node) => node.kind === 'branch');
  const leafNode = validGeneratedMindmapFixture.nodes.find((node) => node.kind === 'leaf');

  assert.ok(branchNode);
  assert.ok(leafNode);

  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [
        { ...branchNode, label: 'Foundations of constitutional law and public authority' },
        { ...leafNode, label: 'Jean-Jacques Rousseau legitimacy-based consent theory and constitutionalism' },
      ],
      edges: [],
    },
    {
      width: 640,
      height: 320,
      nodes: [
        {
          id: branchNode.id,
          x: 40,
          y: 50,
          width: 300,
          height: 220,
        },
        {
          id: leafNode.id,
          x: 360,
          y: 50,
          width: 220,
          height: 180,
        },
      ],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 1.4,
    },
  );

  assert.equal(model.nodes[0]!.kind, 'branch');
  assert.equal(model.nodes[1]!.kind, 'leaf');
  assert.equal(model.nodes[0]!.fontSize > model.nodes[1]!.fontSize, true);
});

test('buildSvgPreviewModel reduces export root font size when long words would overflow horizontally', () => {
  const metrics = getSvgPreviewRenderMetrics('export', { scale: 1.4 });
  const node = validGeneratedMindmapFixture.nodes[0]!;
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [{
        ...node,
        label: 'Historical Development',
      }],
      edges: [],
    },
    {
      width: 320,
      height: 220,
      nodes: [{
        id: node.id,
        x: 40,
        y: 40,
        width: 180,
        height: 140,
      }],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 1.4,
    },
  );

  assert.equal(estimateLongestLineWidth(model.nodes[0]!, metrics, 'root') <= 140, true);
});

test('buildSvgPreviewModel keeps high-scale export root text inside the root node box', () => {
  const node = validGeneratedMindmapFixture.nodes[0]!;
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [{
        ...node,
        label: 'Photosynthesis and cellular energy transfer in multicellular organisms',
      }],
      edges: [],
    },
    {
      width: 420,
      height: 220,
      nodes: [{
        id: node.id,
        x: 40,
        y: 40,
        width: node.layout.minWidth,
        height: node.layout.minHeight,
      }],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 2.5,
    },
  );

  const renderedNode = model.nodes[0]!;
  const textBottomY = renderedNode.lineStartY + renderedNode.lines.length * renderedNode.lineHeight;

  assert.equal(textBottomY <= node.layout.minHeight - node.layout.paddingY, true);
});

test('buildSvgPreviewModel keeps high-scale export branch text inside the branch node box', () => {
  const node = validGeneratedMindmapFixture.nodes[1]!;
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [{
        ...node,
        label: 'Comparative constitutional interpretation and institutional legitimacy across systems',
      }],
      edges: [],
    },
    {
      width: 420,
      height: 220,
      nodes: [{
        id: node.id,
        x: 40,
        y: 40,
        width: node.layout.minWidth,
        height: node.layout.minHeight,
      }],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 2.5,
    },
  );

  const renderedNode = model.nodes[0]!;
  const textBottomY = renderedNode.lineStartY + renderedNode.lines.length * renderedNode.lineHeight;

  assert.equal(textBottomY <= node.layout.minHeight - node.layout.paddingY, true);
});

test('buildSvgPreviewModel splits long hyphenated export tokens into separate lines', () => {
  const metrics = getSvgPreviewRenderMetrics('export', { scale: 1.6 });
  const node = validGeneratedMindmapFixture.nodes[1]!;
  const model = buildSvgPreviewModel(
    {
      ...validGeneratedMindmapFixture,
      nodes: [{
        ...node,
        label: 'Jean-Jacques Rousseau legitimacy-based consent theory',
      }],
      edges: [],
    },
    {
      width: 360,
      height: 260,
      nodes: [{
        id: node.id,
        x: 40,
        y: 40,
        width: 220,
        height: 180,
      }],
      edges: [],
    },
    {
      profile: 'export',
      renderScale: 1.6,
    },
  );

  assert.equal(model.nodes[0]!.lines.length >= 4, true);
  assert.equal(model.nodes[0]!.fontSize < metrics.nodeFontSize, true);
});

function estimateLongestLineWidth(
  node: { lines: string[]; fontSize: number },
  metrics: { approxCharacterWidth: number; rootFontSize: number; nodeFontSize: number },
  kind: 'root' | 'node',
): number {
  const baseFontSize = kind === 'root' ? metrics.rootFontSize : metrics.nodeFontSize;
  const scale = node.fontSize / baseFontSize;
  const approxCharacterWidth = Math.max(1, metrics.approxCharacterWidth * scale * 1.08);
  const widestLine = node.lines.reduce((max, line) => Math.max(max, line.length), 0);

  return widestLine * approxCharacterWidth;
}

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

test('getSvgPreviewRenderMetrics scales export typography metrics', () => {
  const metrics = getSvgPreviewRenderMetrics('export', { scale: 1.5 });

  assert.equal(metrics.nodeFontSize, 31.5);
  assert.equal(metrics.lineHeight, 39);
  assert.equal(metrics.edgeStrokeWidth, 6.75);
});