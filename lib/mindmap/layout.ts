import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, ElkPoint } from 'elkjs/lib/elk-api';

import type { GeneratedMindmap } from './schema.ts';
import { translateMindmapToElkGraph } from './to-elk.ts';

export interface MindmapLayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MindmapLayoutEdge {
  id: string;
  points: ElkPoint[];
}

export interface MindmapLayoutResult {
  width: number;
  height: number;
  nodes: MindmapLayoutNode[];
  edges: MindmapLayoutEdge[];
}

export interface MindmapExportScaleOptions {
  nodeWidthScale?: number;
  nodeHeightScale?: number;
  nodePaddingScale?: number;
  siblingGapScale?: number;
  levelGapScale?: number;
  textScale?: number;
}

export interface MindmapLayoutWorkerRequest {
  type: 'layout';
  requestId: number;
  mindmap: GeneratedMindmap;
}

export interface MindmapLayoutWorkerSuccess {
  type: 'layout-success';
  requestId: number;
  result: MindmapLayoutResult;
}

export interface MindmapLayoutWorkerFailure {
  type: 'layout-error';
  requestId: number;
  message: string;
}

export type MindmapLayoutWorkerResponse =
  | MindmapLayoutWorkerSuccess
  | MindmapLayoutWorkerFailure;

const elk = new ELK();

const defaultMindmapExportScaleOptions: Required<MindmapExportScaleOptions> = {
  nodeWidthScale: 1.42,
  nodeHeightScale: 1.48,
  nodePaddingScale: 1.22,
  siblingGapScale: 1.18,
  levelGapScale: 1.1,
  textScale: 1,
};

export async function layoutMindmapWithElk(
  mindmap: GeneratedMindmap,
): Promise<MindmapLayoutResult> {
  const elkGraph = translateMindmapToElkGraph(mindmap);
  const laidOutGraph = await elk.layout({
    ...elkGraph,
    layoutOptions: createMindmapRadialLayoutOptions(mindmap),
  });

  return {
    width: laidOutGraph.width ?? 0,
    height: laidOutGraph.height ?? 0,
    nodes: (laidOutGraph.children ?? []).map((node) => ({
      id: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
    })),
    edges: (laidOutGraph.edges ?? []).map((edge) => ({
      id: edge.id ?? 'edge',
      points: collectEdgePoints(edge),
    })),
  };
}

export function createExportMindmapVariant(
  mindmap: GeneratedMindmap,
  options: MindmapExportScaleOptions = {},
): GeneratedMindmap {
  const exportScale = {
    ...defaultMindmapExportScaleOptions,
    ...options,
  };
  const textDrivenBoxScale = scaleWithTextInfluence(exportScale.textScale, 0.45);
  const textDrivenPaddingScale = scaleWithTextInfluence(exportScale.textScale, 0.32);
  const effectiveWidthScale = exportScale.nodeWidthScale * textDrivenBoxScale;
  const effectiveHeightScale = exportScale.nodeHeightScale * textDrivenBoxScale;
  const effectivePaddingScale = exportScale.nodePaddingScale * textDrivenPaddingScale;

  return {
    ...mindmap,
    metadata: {
      ...mindmap.metadata,
      layout: {
        ...mindmap.metadata.layout,
        levelGap: scalePositiveInt(mindmap.metadata.layout.levelGap, exportScale.levelGapScale),
        siblingGap: scalePositiveInt(mindmap.metadata.layout.siblingGap, exportScale.siblingGapScale),
        branchGap: scalePositiveInt(mindmap.metadata.layout.branchGap, exportScale.siblingGapScale),
        branchWidthHint: scalePositiveInt(mindmap.metadata.layout.branchWidthHint, effectiveWidthScale),
        branchHeightHint: scalePositiveInt(mindmap.metadata.layout.branchHeightHint, effectiveHeightScale),
        leafWidthHint: scalePositiveInt(mindmap.metadata.layout.leafWidthHint, effectiveWidthScale),
        leafHeightHint: scalePositiveInt(mindmap.metadata.layout.leafHeightHint, effectiveHeightScale),
        nodePaddingX: scaleNonNegativeInt(mindmap.metadata.layout.nodePaddingX, effectivePaddingScale),
        nodePaddingY: scaleNonNegativeInt(mindmap.metadata.layout.nodePaddingY, effectivePaddingScale),
      },
    },
    nodes: mindmap.nodes.map((node) => ({
      ...node,
      layout: {
        ...node.layout,
        minWidth: scalePositiveInt(node.layout.minWidth, effectiveWidthScale),
        minHeight: scalePositiveInt(node.layout.minHeight, effectiveHeightScale),
        paddingX: scaleNonNegativeInt(node.layout.paddingX, effectivePaddingScale),
        paddingY: scaleNonNegativeInt(node.layout.paddingY, effectivePaddingScale),
        siblingGap: scalePositiveInt(node.layout.siblingGap, exportScale.siblingGapScale),
      },
    })),
    edges: mindmap.edges.map((edge) => ({ ...edge })),
    warnings: [...mindmap.warnings],
    errors: [...mindmap.errors],
  };
}

function collectEdgePoints(edge: NonNullable<ElkNode['edges']>[number]): ElkPoint[] {
  const section = edge.sections?.[0];

  if (!section) {
    return [];
  }

  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
}

export function createMindmapRadialLayoutOptions(
  mindmap: GeneratedMindmap,
): Record<string, string> {
  const layout = mindmap.metadata.layout;

  return {
    'elk.algorithm': 'radial',
    'org.eclipse.elk.radial.centerOnRoot': 'true',
    'org.eclipse.elk.radial.compactor': 'WEDGE_COMPACTION',
    'org.eclipse.elk.radial.compactionStepSize': '2',
    'org.eclipse.elk.radial.wedgeCriteria': 'NODE_SIZE',
    'org.eclipse.elk.radial.radius': String(getMindmapRadialRadius(mindmap)),
    'org.eclipse.elk.radial.rotation.computeAdditionalWedgeSpace': 'true',
    'org.eclipse.elk.spacing.nodeNode': String(getMindmapRadialNodeSpacing(mindmap)),
    'org.eclipse.elk.padding': formatElkPadding(getMindmapCanvasPadding(mindmap)),
  };
}

function getMindmapCanvasPadding(mindmap: GeneratedMindmap): number {
  return Math.max(32, Math.min(mindmap.metadata.layout.canvasPadding, 48));
}

function getMindmapRadialRadius(mindmap: GeneratedMindmap): number {
  const nodeSpacing = getMindmapRadialNodeSpacing(mindmap);
  const largestNodeDiagonal = mindmap.nodes.reduce((maxDiagonal, node) => {
    const nodeWidth = node.layout.minWidth + node.layout.paddingX * 2;
    const nodeHeight = node.layout.minHeight + node.layout.paddingY * 2;

    return Math.max(maxDiagonal, Math.hypot(nodeWidth, nodeHeight));
  }, 0);
  const levelCircumferenceRadius = getMindmapLevelCircumferenceRadius(mindmap, nodeSpacing);

  return Math.ceil(
    Math.max(
      mindmap.metadata.layout.levelGap,
      largestNodeDiagonal + nodeSpacing,
      levelCircumferenceRadius,
    ),
  );
}

function getMindmapLevelCircumferenceRadius(
  mindmap: GeneratedMindmap,
  fallbackSpacing: number,
): number {
  const levelNodeDemand = new Map<number, { count: number; arcLength: number }>();

  for (const node of mindmap.nodes) {
    if (node.level === 0) {
      continue;
    }

    const nodeWidth = node.layout.minWidth + node.layout.paddingX * 2;
    const nodeHeight = node.layout.minHeight + node.layout.paddingY * 2;
    const nodeArcLength = Math.hypot(nodeWidth, nodeHeight) + Math.max(node.layout.siblingGap, fallbackSpacing);
    const currentDemand = levelNodeDemand.get(node.level) ?? { count: 0, arcLength: 0 };

    levelNodeDemand.set(node.level, {
      count: currentDemand.count + 1,
      arcLength: currentDemand.arcLength + nodeArcLength,
    });
  }

  let requiredRadius = 0;

  for (const demand of levelNodeDemand.values()) {
    if (demand.count <= 1) {
      continue;
    }

    requiredRadius = Math.max(requiredRadius, demand.arcLength / (2 * Math.PI));
  }

  return requiredRadius;
}

function getMindmapRadialNodeSpacing(mindmap: GeneratedMindmap): number {
  return mindmap.nodes.reduce(
    (maxSpacing, node) => Math.max(maxSpacing, node.layout.siblingGap),
    mindmap.metadata.layout.siblingGap,
  );
}

function formatElkPadding(padding: number): string {
  return `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`;
}

function scalePositiveInt(value: number, factor: number): number {
  return Math.max(1, Math.ceil(value * factor));
}

function scaleNonNegativeInt(value: number, factor: number): number {
  return Math.max(0, Math.ceil(value * factor));
}

function scaleWithTextInfluence(textScale: number, influence: number): number {
  if (textScale <= 1) {
    return textScale;
  }

  return 1 + (textScale - 1) * influence;
}