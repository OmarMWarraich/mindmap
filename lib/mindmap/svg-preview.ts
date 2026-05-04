import type { MindmapLayoutResult } from './layout.ts';
import type {
  GeneratedMindmap,
  MindmapNode,
  MindmapNodeKind,
} from './schema.ts';

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

const rootNodeStyle: SvgPreviewNodeStyle = {
  fill: '#fff7ed',
  stroke: '#f97316',
  text: '#7c2d12',
  accent: '#ea580c',
  edge: '#fb923c',
};

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

export function buildSvgPreviewModel(
  mindmap: GeneratedMindmap,
  layoutResult: MindmapLayoutResult,
): SvgPreviewModel {
  const layoutNodeMap = new Map(layoutResult.nodes.map((node) => [node.id, node]));
  const mindmapNodeMap = new Map(mindmap.nodes.map((node) => [node.id, node]));

  const nodes = mindmap.nodes.flatMap((node) => {
    const layoutNode = layoutNodeMap.get(node.id);

    if (!layoutNode) {
      return [];
    }

    return [createSvgPreviewNode(node, layoutNode)];
  });

  const edges = layoutResult.edges.flatMap((edge) => {
    if (edge.points.length < 2) {
      return [];
    }

    const sourceEdge = mindmap.edges.find((candidate) => candidate.id === edge.id);
    const color = sourceEdge
      ? getNodeVisualStyle(mindmapNodeMap.get(sourceEdge.from) ?? null).edge
      : '#a1a1aa';

    return [{
      id: edge.id,
      path: createEdgePath(edge.points),
      color,
    }];
  });

  const width = Math.max(
    layoutResult.width,
    ...layoutResult.nodes.map((node) => node.x + node.width),
  );
  const height = Math.max(
    layoutResult.height,
    ...layoutResult.nodes.map((node) => node.y + node.height),
  );

  return {
    width,
    height,
    nodes,
    edges,
  };
}

function createSvgPreviewNode(
  sourceNode: MindmapNode,
  layoutNode: MindmapLayoutResult['nodes'][number],
): SvgPreviewNode {
  return {
    id: sourceNode.id,
    kind: sourceNode.kind,
    label: sourceNode.label,
    lines: wrapMindmapLabel(
      sourceNode.label,
      Math.max(10, Math.floor((layoutNode.width - sourceNode.layout.paddingX * 2) / 8)),
    ),
    x: layoutNode.x,
    y: layoutNode.y,
    width: layoutNode.width,
    height: layoutNode.height,
    style: getNodeVisualStyle(sourceNode),
  };
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

export function wrapMindmapLabel(label: string, maxCharsPerLine: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    const nextLine = `${currentLine} ${word}`;

    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  lines.push(currentLine);
  return lines;
}

function getNodeVisualStyle(node: MindmapNode | null): SvgPreviewNodeStyle {
  if (!node || node.kind === 'root' || !node.style?.colorToken) {
    return rootNodeStyle;
  }

  return branchTokenStyles[node.style.colorToken][node.style.tintTone ?? 'base'];
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