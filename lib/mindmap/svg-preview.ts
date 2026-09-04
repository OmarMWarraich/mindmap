import type { MindmapInlineSegment } from '../dsl/inline-formatting.ts';
import { parseMindmapInlineSegments } from '../dsl/inline-formatting.ts';
import type { MindmapLayoutResult } from './layout.ts';
import type {
  GeneratedMindmap,
  MindmapNode,
  MindmapNodeKind,
} from './schema.ts';
import type { MindmapTheme } from './theme.ts';
import { defaultMindmapTheme } from './theme.ts';

export interface SvgPreviewNodeStyle {
  fill: string;
  stroke: string;
  text: string;
  accent: string;
  edge: string;
}

export interface SvgPreviewNode {
  id: string;
  kind: MindmapNodeKind;
  label: string;
  lines: string[];
  lineSegments: MindmapInlineSegment[][];
  fontSize: number;
  lineHeight: number;
  lineStartY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  style: SvgPreviewNodeStyle;
}

export interface SvgPreviewEdge {
  id: string;
  path: string;
  color: string;
}

export interface SvgPreviewModel {
  width: number;
  height: number;
  nodes: SvgPreviewNode[];
  edges: SvgPreviewEdge[];
}

export interface SvgPreviewTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface ExportTypographyTargets {
  rootFontSize: number;
  branchFontSize: number;
  leafFontSize: number;
}

export interface SvgPreviewRenderScaleOptions {
  scale?: number;
}

export type SvgPreviewRenderProfile = 'preview' | 'export';

interface SvgPreviewRenderMetrics {
  approxCharacterWidth: number;
  lineHeight: number;
  rootFontSize: number;
  nodeFontSize: number;
  rootLineStartY: number;
  nodeLineStartY: number;
  rootStrokeWidth: number;
  nodeStrokeWidth: number;
  rootCornerRadius: number;
  nodeCornerRadius: number;
  edgeStrokeWidth: number;
  accentHeight: number;
  accentMinWidth: number;
  accentWidthRatio: number;
  accentInsetX: number;
  accentInsetY: number;
}

const exportSharedRootFontScaleFloor = 0.82;
const exportSharedNodeFontScaleFloor = 0.84;
const exportSharedFontSizePercentile = 0.35;

const rootNodeStyle: SvgPreviewNodeStyle = {
  fill: '#fff7ed',
  stroke: '#f97316',
  text: '#111827',
  accent: '#ea580c',
  edge: '#fb923c',
};

const readableNodeTextColor = '#111827';

const branchTokenStyles = {
  amber: {
    strong: { fill: '#fef3c7', stroke: '#d97706', text: '#78350f', accent: '#f59e0b', edge: '#f59e0b' },
    base: { fill: '#fffbeb', stroke: '#f59e0b', text: '#92400e', accent: '#fbbf24', edge: '#fbbf24' },
    soft: { fill: '#fffbeb', stroke: '#fcd34d', text: '#a16207', accent: '#fcd34d', edge: '#fcd34d' },
    subtle: { fill: '#fffbeb', stroke: '#fde68a', text: '#a16207', accent: '#fde68a', edge: '#fde68a' },
  },
  emerald: {
    strong: { fill: '#d1fae5', stroke: '#059669', text: '#064e3b', accent: '#10b981', edge: '#10b981' },
    base: { fill: '#ecfdf5', stroke: '#10b981', text: '#065f46', accent: '#34d399', edge: '#34d399' },
    soft: { fill: '#ecfdf5', stroke: '#6ee7b7', text: '#047857', accent: '#6ee7b7', edge: '#6ee7b7' },
    subtle: { fill: '#ecfdf5', stroke: '#a7f3d0', text: '#047857', accent: '#a7f3d0', edge: '#a7f3d0' },
  },
  sky: {
    strong: { fill: '#e0f2fe', stroke: '#0284c7', text: '#0c4a6e', accent: '#0ea5e9', edge: '#0ea5e9' },
    base: { fill: '#f0f9ff', stroke: '#38bdf8', text: '#075985', accent: '#38bdf8', edge: '#38bdf8' },
    soft: { fill: '#f0f9ff', stroke: '#7dd3fc', text: '#0369a1', accent: '#7dd3fc', edge: '#7dd3fc' },
    subtle: { fill: '#f0f9ff', stroke: '#bae6fd', text: '#0369a1', accent: '#bae6fd', edge: '#bae6fd' },
  },
  violet: {
    strong: { fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95', accent: '#8b5cf6', edge: '#8b5cf6' },
    base: { fill: '#f5f3ff', stroke: '#8b5cf6', text: '#5b21b6', accent: '#a78bfa', edge: '#a78bfa' },
    soft: { fill: '#f5f3ff', stroke: '#c4b5fd', text: '#6d28d9', accent: '#c4b5fd', edge: '#c4b5fd' },
    subtle: { fill: '#f5f3ff', stroke: '#ddd6fe', text: '#6d28d9', accent: '#ddd6fe', edge: '#ddd6fe' },
  },
  rose: {
    strong: { fill: '#ffe4e6', stroke: '#e11d48', text: '#881337', accent: '#f43f5e', edge: '#f43f5e' },
    base: { fill: '#fff1f2', stroke: '#fb7185', text: '#9f1239', accent: '#fb7185', edge: '#fb7185' },
    soft: { fill: '#fff1f2', stroke: '#fda4af', text: '#be123c', accent: '#fda4af', edge: '#fda4af' },
    subtle: { fill: '#fff1f2', stroke: '#fecdd3', text: '#be123c', accent: '#fecdd3', edge: '#fecdd3' },
  },
  teal: {
    strong: { fill: '#ccfbf1', stroke: '#0f766e', text: '#134e4a', accent: '#14b8a6', edge: '#14b8a6' },
    base: { fill: '#f0fdfa', stroke: '#14b8a6', text: '#115e59', accent: '#2dd4bf', edge: '#2dd4bf' },
    soft: { fill: '#f0fdfa', stroke: '#5eead4', text: '#0f766e', accent: '#5eead4', edge: '#5eead4' },
    subtle: { fill: '#f0fdfa', stroke: '#99f6e4', text: '#0f766e', accent: '#99f6e4', edge: '#99f6e4' },
  },
} as const;

const previewRenderMetrics: SvgPreviewRenderMetrics = {
  approxCharacterWidth: 8,
  lineHeight: 20,
  rootFontSize: 22,
  nodeFontSize: 16,
  rootLineStartY: 50,
  nodeLineStartY: 42,
  rootStrokeWidth: 3,
  nodeStrokeWidth: 2,
  rootCornerRadius: 28,
  nodeCornerRadius: 24,
  edgeStrokeWidth: 4,
  accentHeight: 6,
  accentMinWidth: 44,
  accentWidthRatio: 0.28,
  accentInsetX: 18,
  accentInsetY: 16,
};

const exportRenderMetrics: SvgPreviewRenderMetrics = {
  approxCharacterWidth: 10,
  lineHeight: 26,
  rootFontSize: 30,
  nodeFontSize: 21,
  rootLineStartY: 62,
  nodeLineStartY: 52,
  rootStrokeWidth: 4,
  nodeStrokeWidth: 3,
  rootCornerRadius: 34,
  nodeCornerRadius: 28,
  edgeStrokeWidth: 5,
  accentHeight: 8,
  accentMinWidth: 56,
  accentWidthRatio: 0.3,
  accentInsetX: 22,
  accentInsetY: 18,
};

export function buildSvgPreviewModel(
  mindmap: GeneratedMindmap,
  layoutResult: MindmapLayoutResult,
  options: {
    profile?: SvgPreviewRenderProfile;
    renderScale?: number;
    canvasPadding?: number;
    theme?: MindmapTheme;
  } = {},
): SvgPreviewModel {
  const profile = options.profile ?? 'preview';
  const theme = options.theme ?? defaultMindmapTheme;
  const metrics = applyThemeTypographyToMetrics(
    getSvgPreviewRenderMetrics(profile, { scale: options.renderScale }),
    theme,
  );
  const layoutNodeMap = new Map(layoutResult.nodes.map((node) => [node.id, node]));
  const mindmapNodeMap = new Map(mindmap.nodes.map((node) => [node.id, node]));
  const canvasPadding = Math.max(0, options.canvasPadding ?? 0);
  const exportTypographyTargets = profile === 'export'
    ? createExportTypographyTargets(mindmap, layoutNodeMap, metrics)
    : null;

  const bounds = resolveSvgPreviewBounds(layoutResult, canvasPadding);

  const nodes = mindmap.nodes.flatMap((node) => {
    const layoutNode = layoutNodeMap.get(node.id);

    if (!layoutNode) {
      return [];
    }

    return [createSvgPreviewNode(
      node,
      {
        ...layoutNode,
        x: layoutNode.x + bounds.offsetX,
        y: layoutNode.y + bounds.offsetY,
      },
      metrics,
      profile,
      exportTypographyTargets,
      theme,
    )];
  });

  const edges = layoutResult.edges.flatMap((edge) => {
    if (edge.points.length < 2) {
      return [];
    }

    const sourceEdge = mindmap.edges.find((candidate) => candidate.id === edge.id);
    const color = theme.edge.colorMode === 'mono' && theme.edge.monoColor
      ? theme.edge.monoColor
      : sourceEdge
        ? resolveThemedNodeStyle(mindmapNodeMap.get(sourceEdge.from) ?? null, theme).edge
        : '#a1a1aa';
    const adjustedPoints = edge.points.map((point) => ({
      x: point.x + bounds.offsetX,
      y: point.y + bounds.offsetY,
    }));

    return [{
      id: edge.id,
      path: createEdgePath(adjustedPoints),
      color,
    }];
  });

  return {
    width: bounds.width,
    height: bounds.height,
    nodes,
    edges,
  };
}

function resolveSvgPreviewBounds(
  layoutResult: MindmapLayoutResult,
  canvasPadding: number,
): {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
} {
  let minX = 0;
  let minY = 0;
  let maxX = Math.max(0, layoutResult.width);
  let maxY = Math.max(0, layoutResult.height);

  for (const node of layoutResult.nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  for (const edge of layoutResult.edges) {
    for (const point of edge.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  const offsetX = canvasPadding - minX;
  const offsetY = canvasPadding - minY;

  return {
    width: Math.max(1, Math.ceil(maxX + offsetX + canvasPadding)),
    height: Math.max(1, Math.ceil(maxY + offsetY + canvasPadding)),
    offsetX,
    offsetY,
  };
}

function createSvgPreviewNode(
  sourceNode: MindmapNode,
  layoutNode: MindmapLayoutResult['nodes'][number],
  metrics: SvgPreviewRenderMetrics,
  profile: SvgPreviewRenderProfile,
  exportTypographyTargets: ExportTypographyTargets | null,
  theme: MindmapTheme,
): SvgPreviewNode {
  const typography = createNodeTypography(
    sourceNode,
    layoutNode,
    metrics,
    profile,
    sourceNode.kind === 'root'
      ? exportTypographyTargets?.rootFontSize
      : sourceNode.kind === 'branch'
        ? exportTypographyTargets?.branchFontSize
        : exportTypographyTargets?.leafFontSize,
  );

  return {
    id: sourceNode.id,
    kind: sourceNode.kind,
    label: sourceNode.label,
    lines: typography.lines,
    lineSegments: typography.lineSegments,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight,
    lineStartY: typography.lineStartY,
    x: layoutNode.x,
    y: layoutNode.y,
    width: layoutNode.width,
    height: layoutNode.height,
    style: resolveThemedNodeStyle(sourceNode, theme),
  };
}

export function getSvgPreviewRenderMetrics(
  profile: SvgPreviewRenderProfile = 'preview',
  options: SvgPreviewRenderScaleOptions = {},
): SvgPreviewRenderMetrics {
  const metrics = profile === 'export' ? exportRenderMetrics : previewRenderMetrics;
  const scale = options.scale ?? 1;

  if (scale === 1) {
    return metrics;
  }

  return {
    ...metrics,
    approxCharacterWidth: Math.max(1, metrics.approxCharacterWidth * scale),
    lineHeight: Math.max(1, metrics.lineHeight * scale),
    rootFontSize: Math.max(1, metrics.rootFontSize * scale),
    nodeFontSize: Math.max(1, metrics.nodeFontSize * scale),
    rootLineStartY: Math.max(1, metrics.rootLineStartY * scale),
    nodeLineStartY: Math.max(1, metrics.nodeLineStartY * scale),
    rootStrokeWidth: Math.max(1, metrics.rootStrokeWidth * Math.max(1, scale * 0.9)),
    nodeStrokeWidth: Math.max(1, metrics.nodeStrokeWidth * Math.max(1, scale * 0.9)),
    rootCornerRadius: Math.max(1, metrics.rootCornerRadius * scale),
    nodeCornerRadius: Math.max(1, metrics.nodeCornerRadius * scale),
    edgeStrokeWidth: Math.max(1, metrics.edgeStrokeWidth * Math.max(1, scale * 0.9)),
    accentHeight: Math.max(1, metrics.accentHeight * scale),
    accentMinWidth: Math.max(1, metrics.accentMinWidth * scale),
    accentInsetX: Math.max(1, metrics.accentInsetX * scale),
    accentInsetY: Math.max(1, metrics.accentInsetY * scale),
  };
}

export function createSvgPreviewSnapshot(
  mindmap: GeneratedMindmap,
  layoutResult: MindmapLayoutResult,
  options: {
    profile?: SvgPreviewRenderProfile;
    renderScale?: number;
    theme?: MindmapTheme;
  } = {},
): { node: SVGSVGElement; width: number; height: number } {
  if (typeof document === 'undefined') {
    throw new Error('SVG preview snapshots require a browser document.');
  }

  const profile = options.profile ?? 'preview';
  const theme = options.theme ?? defaultMindmapTheme;
  const metrics = applyThemeTypographyToMetrics(
    getSvgPreviewRenderMetrics(profile, { scale: options.renderScale }),
    theme,
  );
  const exportPadding = Math.ceil(
    Math.max(metrics.edgeStrokeWidth, metrics.rootStrokeWidth, metrics.nodeStrokeWidth) + 4,
  );
  const model = buildSvgPreviewModel(mindmap, layoutResult, {
    profile,
    renderScale: options.renderScale,
    canvasPadding: exportPadding,
    theme,
  });
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const width = Math.max(1, Math.ceil(model.width));
  const height = Math.max(1, Math.ceil(model.height));

  svg.setAttribute('xmlns', svgNs);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  appendThemedBackground(svg, svgNs, theme.background, width, height);

  const edgeGroup = document.createElementNS(svgNs, 'g');
  edgeGroup.setAttribute('fill', 'none');
  edgeGroup.setAttribute('stroke-linecap', 'round');
  edgeGroup.setAttribute('stroke-linejoin', 'round');

  for (const edge of model.edges) {
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', edge.path);
    path.setAttribute('stroke', edge.color);
    path.setAttribute('stroke-opacity', String(theme.edge.opacity));
    path.setAttribute('stroke-width', String(metrics.edgeStrokeWidth * theme.edge.strokeWidthScale));
    edgeGroup.append(path);
  }

  svg.append(edgeGroup);

  const nodeGroup = document.createElementNS(svgNs, 'g');

  for (const node of model.nodes) {
    const nodeWrapper = document.createElementNS(svgNs, 'g');
    nodeWrapper.setAttribute('transform', `translate(${node.x} ${node.y})`);

    const cornerRadius =
      (node.kind === 'root' ? metrics.rootCornerRadius : metrics.nodeCornerRadius)
      * theme.node.cornerRadiusScale;

    if (theme.node.frostOpacity > 0) {
      const frost = document.createElementNS(svgNs, 'rect');
      frost.setAttribute('x', '0');
      frost.setAttribute('y', '0');
      frost.setAttribute('width', String(node.width));
      frost.setAttribute('height', String(node.height));
      frost.setAttribute('fill', '#ffffff');
      frost.setAttribute('fill-opacity', String(theme.node.frostOpacity));
      frost.setAttribute('rx', String(cornerRadius));
      nodeWrapper.append(frost);
    }

    const frame = document.createElementNS(svgNs, 'rect');
    frame.setAttribute('x', '0');
    frame.setAttribute('y', '0');
    frame.setAttribute('width', String(node.width));
    frame.setAttribute('height', String(node.height));
    frame.setAttribute('fill', node.style.fill);

    if (theme.node.fillOpacity < 1) {
      frame.setAttribute('fill-opacity', String(theme.node.fillOpacity));
    }

    frame.setAttribute('stroke', node.style.stroke);
    frame.setAttribute(
      'stroke-width',
      String(
        (node.kind === 'root' ? metrics.rootStrokeWidth : metrics.nodeStrokeWidth)
        * theme.node.strokeWidthScale,
      ),
    );
    frame.setAttribute('rx', String(cornerRadius));
    nodeWrapper.append(frame);

    const accent = document.createElementNS(svgNs, 'rect');
    accent.setAttribute('x', String(metrics.accentInsetX));
    accent.setAttribute('y', String(metrics.accentInsetY));
    accent.setAttribute('width', String(Math.max(metrics.accentMinWidth, node.width * metrics.accentWidthRatio)));
    accent.setAttribute('height', String(metrics.accentHeight));
    accent.setAttribute('rx', String(metrics.accentHeight / 2));
    accent.setAttribute('fill', node.style.accent);
    nodeWrapper.append(accent);

    const text = document.createElementNS(svgNs, 'text');
    text.setAttribute('x', String(node.width / 2));
    text.setAttribute('fill', node.style.text);
    text.setAttribute('font-family', theme.typography.fontFamily);
    text.setAttribute('font-size', String(node.fontSize));
    text.setAttribute('font-weight', node.kind === 'root' ? '800' : '700');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'hanging');

    for (const [index, segments] of node.lineSegments.entries()) {
      for (const [segmentIndex, segment] of segments.entries()) {
        const tspan = document.createElementNS(svgNs, 'tspan');

        // Only the first tspan of a line is positioned; the rest flow in the
        // same text chunk so the whole styled line centers as one unit.
        if (segmentIndex === 0) {
          tspan.setAttribute('x', String(node.width / 2));
          tspan.setAttribute('y', String(node.lineStartY + index * node.lineHeight));
        }

        if (segment.bold) {
          tspan.setAttribute('font-weight', '900');
        }

        if (segment.italic) {
          tspan.setAttribute('font-style', 'italic');
        }

        if (segment.underline) {
          tspan.setAttribute('text-decoration', 'underline');
        }

        tspan.textContent = segment.text;
        text.append(tspan);
      }
    }

    nodeWrapper.append(text);
    nodeGroup.append(nodeWrapper);
  }

  svg.append(nodeGroup);

  return {
    node: svg,
    width,
    height,
  };
}

function appendThemedBackground(
  svg: SVGSVGElement,
  svgNs: string,
  background: MindmapTheme['background'],
  width: number,
  height: number,
): void {
  const fullRect = (): SVGRectElement => {
    const rect = document.createElementNS(svgNs, 'rect') as SVGRectElement;
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    return rect;
  };

  if (background.kind === 'grid') {
    const defs = document.createElementNS(svgNs, 'defs');
    const pattern = document.createElementNS(svgNs, 'pattern');
    pattern.setAttribute('id', 'mindmap-export-grid');
    pattern.setAttribute('width', '32');
    pattern.setAttribute('height', '32');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const patternPath = document.createElementNS(svgNs, 'path');
    patternPath.setAttribute('d', 'M 32 0 L 0 0 0 32');
    patternPath.setAttribute('fill', 'none');
    patternPath.setAttribute('stroke', 'rgba(148,163,184,0.12)');
    patternPath.setAttribute('stroke-width', '1');
    pattern.append(patternPath);
    defs.append(pattern);
    svg.append(defs);

    const rect = fullRect();
    rect.setAttribute('fill', 'url(#mindmap-export-grid)');
    svg.append(rect);
    return;
  }

  if (background.kind === 'solid') {
    const rect = fullRect();
    rect.setAttribute('fill', background.color);
    svg.append(rect);
    return;
  }

  if (background.kind === 'gradient') {
    const defs = document.createElementNS(svgNs, 'defs');
    const gradient = document.createElementNS(svgNs, 'linearGradient');
    gradient.setAttribute('id', 'mindmap-theme-gradient');
    gradient.setAttribute('gradientTransform', `rotate(${background.angle} 0.5 0.5)`);
    const fromStop = document.createElementNS(svgNs, 'stop');
    fromStop.setAttribute('offset', '0%');
    fromStop.setAttribute('stop-color', background.from);
    const toStop = document.createElementNS(svgNs, 'stop');
    toStop.setAttribute('offset', '100%');
    toStop.setAttribute('stop-color', background.to);
    gradient.append(fromStop, toStop);
    defs.append(gradient);
    svg.append(defs);

    const rect = fullRect();
    rect.setAttribute('fill', 'url(#mindmap-theme-gradient)');
    svg.append(rect);
    return;
  }

  const image = document.createElementNS(svgNs, 'image');
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));
  image.setAttribute('href', background.imageDataUrl);
  image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.append(image);

  const overlay = fullRect();
  overlay.setAttribute('fill', background.overlayColor);
  overlay.setAttribute('fill-opacity', String(background.overlayOpacity));
  svg.append(overlay);
}

export function createEdgePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    const [point] = points;

    return `M ${point.x} ${point.y}`;
  }

  if (points.length === 2) {
    const [start, end] = points;
    const control = createSingleCurveControlPoint(start, end);

    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }

  const segments = [`M ${points[0]!.x} ${points[0]!.y}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const nextPoint = points[index + 1]!;
    const midpoint = {
      x: (point.x + nextPoint.x) / 2,
      y: (point.y + nextPoint.y) / 2,
    };

    segments.push(`Q ${point.x} ${point.y} ${midpoint.x} ${midpoint.y}`);
  }

  const penultimatePoint = points[points.length - 2]!;
  const finalPoint = points[points.length - 1]!;
  segments.push(`Q ${penultimatePoint.x} ${penultimatePoint.y} ${finalPoint.x} ${finalPoint.y}`);

  return segments.join(' ');
}

function createNodeTypography(
  sourceNode: MindmapNode,
  layoutNode: MindmapLayoutResult['nodes'][number],
  metrics: SvgPreviewRenderMetrics,
  profile: SvgPreviewRenderProfile,
  targetFontSize?: number,
): Pick<SvgPreviewNode, 'lines' | 'lineSegments' | 'fontSize' | 'lineHeight' | 'lineStartY'> {
  const baseFontSize = sourceNode.kind === 'root' ? metrics.rootFontSize : metrics.nodeFontSize;
  const baseLineStartY = sourceNode.kind === 'root' ? metrics.rootLineStartY : metrics.nodeLineStartY;
  const availableWidth = Math.max(64, layoutNode.width - sourceNode.layout.paddingX * 2);

  if (profile !== 'export') {
    const wrapped = wrapFormattedMindmapLabel(
      sourceNode.label,
      Math.max(8, Math.floor(availableWidth / metrics.approxCharacterWidth)),
    );

    return {
      lines: wrapped.lines,
      lineSegments: wrapped.lineSegments,
      fontSize: baseFontSize,
      lineHeight: metrics.lineHeight,
      lineStartY: baseLineStartY,
    };
  }

  const availableBottomY = Math.max(metrics.lineHeight, layoutNode.height - sourceNode.layout.paddingY);
  const minimumFontSize = 12;
  const initialFontSize = Math.min(baseFontSize, targetFontSize ?? baseFontSize);
  let bestTypography = measureNodeTypography(
    sourceNode.label,
    availableWidth,
    initialFontSize,
    metrics,
    baseFontSize,
    baseLineStartY,
  );

  for (let fontSize = initialFontSize; fontSize >= minimumFontSize; fontSize -= 0.5) {
    const candidate = measureNodeTypography(
      sourceNode.label,
      availableWidth,
      fontSize,
      metrics,
      baseFontSize,
      baseLineStartY,
    );

    bestTypography = candidate;

    if (doesNodeTypographyFit(candidate, availableWidth, availableBottomY, metrics, baseFontSize)) {
      break;
    }
  }

  return bestTypography;
}

function createExportTypographyTargets(
  mindmap: GeneratedMindmap,
  layoutNodeMap: Map<string, MindmapLayoutResult['nodes'][number]>,
  metrics: SvgPreviewRenderMetrics,
): ExportTypographyTargets {
  const rootFontSizes: number[] = [];
  const branchFontSizes: number[] = [];
  const leafFontSizes: number[] = [];

  for (const node of mindmap.nodes) {
    const layoutNode = layoutNodeMap.get(node.id);

    if (!layoutNode) {
      continue;
    }

    const fittedFontSize = findFittingExportFontSize(node, layoutNode, metrics);

    if (node.kind === 'root') {
      rootFontSizes.push(fittedFontSize);
      continue;
    }

    if (node.kind === 'branch') {
      branchFontSizes.push(fittedFontSize);
      continue;
    }

    leafFontSizes.push(fittedFontSize);
  }

  return {
    rootFontSize: resolveSharedExportFontSize(
      rootFontSizes,
      metrics.rootFontSize,
      exportSharedRootFontScaleFloor,
    ),
    branchFontSize: resolveSharedExportFontSize(
      branchFontSizes,
      metrics.nodeFontSize,
      exportSharedNodeFontScaleFloor,
    ),
    leafFontSize: resolveSharedExportFontSize(
      leafFontSizes,
      metrics.nodeFontSize,
      exportSharedNodeFontScaleFloor,
    ),
  };
}

function resolveSharedExportFontSize(
  fittedFontSizes: number[],
  baseFontSize: number,
  readableScaleFloor: number,
): number {
  if (fittedFontSizes.length === 0) {
    return baseFontSize;
  }

  const sortedFontSizes = [...fittedFontSizes].sort((left, right) => left - right);
  const percentileIndex = Math.min(
    sortedFontSizes.length - 1,
    Math.max(0, Math.floor((sortedFontSizes.length - 1) * exportSharedFontSizePercentile)),
  );
  const percentileFontSize = sortedFontSizes[percentileIndex] ?? baseFontSize;

  return Math.max(baseFontSize * readableScaleFloor, percentileFontSize);
}

function findFittingExportFontSize(
  sourceNode: MindmapNode,
  layoutNode: MindmapLayoutResult['nodes'][number],
  metrics: SvgPreviewRenderMetrics,
): number {
  const baseFontSize = sourceNode.kind === 'root' ? metrics.rootFontSize : metrics.nodeFontSize;
  const baseLineStartY = sourceNode.kind === 'root' ? metrics.rootLineStartY : metrics.nodeLineStartY;
  const availableWidth = Math.max(64, layoutNode.width - sourceNode.layout.paddingX * 2);
  const availableBottomY = Math.max(metrics.lineHeight, layoutNode.height - sourceNode.layout.paddingY);
  const minimumFontSize = 12;

  for (let fontSize = baseFontSize; fontSize >= minimumFontSize; fontSize -= 0.5) {
    const candidate = measureNodeTypography(
      sourceNode.label,
      availableWidth,
      fontSize,
      metrics,
      baseFontSize,
      baseLineStartY,
    );

    if (doesNodeTypographyFit(candidate, availableWidth, availableBottomY, metrics, baseFontSize)) {
      return fontSize;
    }
  }

  return minimumFontSize;
}

function measureNodeTypography(
  label: string,
  availableWidth: number,
  fontSize: number,
  metrics: SvgPreviewRenderMetrics,
  baseFontSize: number,
  baseLineStartY: number,
): Pick<SvgPreviewNode, 'lines' | 'lineSegments' | 'fontSize' | 'lineHeight' | 'lineStartY'> {
  const scale = fontSize / baseFontSize;
  const approxCharacterWidth = Math.max(1, metrics.approxCharacterWidth * scale);
  const lineHeight = Math.max(fontSize * 1.18, metrics.lineHeight * scale);
  const lineStartY = Math.max(
    fontSize * 1.35,
    Math.min(baseLineStartY * scale, metrics.accentInsetY + metrics.accentHeight + fontSize * 0.72),
  );
  const wrapped = wrapFormattedMindmapLabel(
    label,
    Math.max(8, Math.floor(availableWidth / approxCharacterWidth)),
  );

  return {
    lines: wrapped.lines,
    lineSegments: wrapped.lineSegments,
    fontSize,
    lineHeight,
    lineStartY,
  };
}

function doesNodeTypographyFit(
  typography: Pick<SvgPreviewNode, 'lines' | 'fontSize' | 'lineHeight' | 'lineStartY'>,
  availableWidth: number,
  availableBottomY: number,
  metrics: SvgPreviewRenderMetrics,
  baseFontSize: number,
): boolean {
  const scale = typography.fontSize / baseFontSize;
  const approxCharacterWidth = Math.max(1, metrics.approxCharacterWidth * scale * 1.08);
  const widestLine = typography.lines.reduce((max, line) => Math.max(max, line.length), 0);
  const fitsWidth = widestLine * approxCharacterWidth <= availableWidth;
  const fitsHeight = typography.lineStartY + typography.lines.length * typography.lineHeight <= availableBottomY;

  return fitsWidth && fitsHeight;
}

function createSingleCurveControlPoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number } {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const curveStrength = Math.min(160, Math.max(32, length * 0.18));
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  return {
    x: midpoint.x - (deltaY / length) * curveStrength,
    y: midpoint.y + (deltaX / length) * curveStrength,
  };
}

export function wrapFormattedMindmapLabel(
  label: string,
  maxCharsPerLine: number,
): { lines: string[]; lineSegments: MindmapInlineSegment[][] } {
  const segments = parseMindmapInlineSegments(label);
  const plainLabel = segments.map((segment) => segment.text).join('');
  const lines = wrapMindmapLabel(plainLabel, maxCharsPerLine);
  const styledChars = segments.flatMap((segment) =>
    [...segment.text].map((ch) => ({
      ch,
      bold: segment.bold,
      italic: segment.italic,
      underline: segment.underline,
    })),
  );

  // Wrapping only collapses/removes whitespace, so non-space characters map
  // 1:1 onto the styled character stream in order.
  let cursor = 0;
  const lineSegments = lines.map((line) => {
    const lineChars: Array<{ ch: string } & Omit<MindmapInlineSegment, 'text'>> = [];

    for (const ch of line) {
      if (/\s/.test(ch)) {
        const style = styledChars[cursor];

        while (cursor < styledChars.length && /\s/.test(styledChars[cursor]!.ch)) {
          cursor += 1;
        }

        lineChars.push({
          ch,
          bold: style?.bold ?? false,
          italic: style?.italic ?? false,
          underline: style?.underline ?? false,
        });
        continue;
      }

      while (cursor < styledChars.length && /\s/.test(styledChars[cursor]!.ch)) {
        cursor += 1;
      }

      const style = styledChars[cursor];
      lineChars.push({
        ch,
        bold: style?.bold ?? false,
        italic: style?.italic ?? false,
        underline: style?.underline ?? false,
      });

      if (style) {
        cursor += 1;
      }
    }

    return mergeStyledLineChars(line, lineChars);
  });

  return { lines, lineSegments };
}

function mergeStyledLineChars(
  line: string,
  chars: Array<{ ch: string } & Omit<MindmapInlineSegment, 'text'>>,
): MindmapInlineSegment[] {
  const merged: MindmapInlineSegment[] = [];

  for (const { ch, bold, italic, underline } of chars) {
    const last = merged.at(-1);

    if (last && last.bold === bold && last.italic === italic && last.underline === underline) {
      last.text += ch;
      continue;
    }

    merged.push({ text: ch, bold, italic, underline });
  }

  if (merged.length === 0) {
    return [{ text: line, bold: false, italic: false, underline: false }];
  }

  return merged;
}

export function wrapMindmapLabel(label: string, maxCharsPerLine: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const fragments = splitLabelToken(word, maxCharsPerLine);

    for (const [fragmentIndex, fragment] of fragments.entries()) {
      if (currentLine.length === 0) {
        currentLine = fragment;
        continue;
      }

      const nextLine = fragmentIndex === 0
        ? `${currentLine} ${fragment}`
        : `${currentLine}${fragment}`;

      if (nextLine.length <= maxCharsPerLine) {
        currentLine = nextLine;
        continue;
      }

      lines.push(currentLine);
      currentLine = fragment;
    }
  }

  lines.push(currentLine);
  return lines;
}

function splitLabelToken(token: string, maxCharsPerLine: number): string[] {
  if (token.length <= maxCharsPerLine) {
    return [token];
  }

  const separatedFragments = token.match(/[^/-]+(?:[-/])?|[-/]/g);

  if (separatedFragments && separatedFragments.length > 1) {
    const packedFragments: string[] = [];
    let currentFragment = '';

    for (const fragment of separatedFragments) {
      const candidate = `${currentFragment}${fragment}`;

      if (candidate.length <= maxCharsPerLine) {
        currentFragment = candidate;
        continue;
      }

      if (currentFragment) {
        packedFragments.push(currentFragment);
      }

      currentFragment = fragment;
    }

    if (currentFragment) {
      packedFragments.push(currentFragment);
    }

    return packedFragments.flatMap((fragment) => hardSplitLabelToken(fragment, maxCharsPerLine));
  }

  return hardSplitLabelToken(token, maxCharsPerLine);
}

function hardSplitLabelToken(token: string, maxCharsPerLine: number): string[] {
  const fragments: string[] = [];

  for (let index = 0; index < token.length; index += maxCharsPerLine) {
    fragments.push(token.slice(index, index + maxCharsPerLine));
  }

  return fragments;
}

function getNodeVisualStyle(node: MindmapNode | null): SvgPreviewNodeStyle {
  if (!node || node.kind === 'root' || !node.style?.colorToken) {
    return rootNodeStyle;
  }

  return {
    ...branchTokenStyles[node.style.colorToken][node.style.tintTone ?? 'base'],
    text: readableNodeTextColor,
  };
}

function resolveThemedNodeStyle(node: MindmapNode | null, theme: MindmapTheme): SvgPreviewNodeStyle {
  const base = getNodeVisualStyle(node);
  const override = theme.node[node?.kind ?? 'root'];

  if (!override) {
    return base;
  }

  return {
    fill: override.fill ?? base.fill,
    stroke: override.stroke ?? base.stroke,
    text: override.text ?? base.text,
    accent: override.accent ?? base.accent,
    edge: base.edge,
  };
}

function applyThemeTypographyToMetrics(
  metrics: SvgPreviewRenderMetrics,
  theme: MindmapTheme,
): SvgPreviewRenderMetrics {
  const { rootFontScale, nodeFontScale } = theme.typography;

  if (rootFontScale === 1 && nodeFontScale === 1) {
    return metrics;
  }

  return {
    ...metrics,
    rootFontSize: Math.max(1, metrics.rootFontSize * rootFontScale),
    nodeFontSize: Math.max(1, metrics.nodeFontSize * nodeFontScale),
  };
}

export function createDefaultSvgPreviewTransform(): SvgPreviewTransform {
  return {
    scale: 1,
    translateX: 0,
    translateY: 0,
  };
}

export function clampSvgPreviewScale(scale: number): number {
  return Math.min(2.4, Math.max(0.55, scale));
}

export function panSvgPreviewTransform(
  transform: SvgPreviewTransform,
  delta: { x: number; y: number },
): SvgPreviewTransform {
  return {
    ...transform,
    translateX: transform.translateX + delta.x,
    translateY: transform.translateY + delta.y,
  };
}

export function zoomSvgPreviewAroundPoint(
  transform: SvgPreviewTransform,
  nextScale: number,
  anchor: { x: number; y: number },
): SvgPreviewTransform {
  const clampedScale = clampSvgPreviewScale(nextScale);
  const scaleRatio = clampedScale / transform.scale;

  return {
    scale: clampedScale,
    translateX: anchor.x - scaleRatio * (anchor.x - transform.translateX),
    translateY: anchor.y - scaleRatio * (anchor.y - transform.translateY),
  };
}