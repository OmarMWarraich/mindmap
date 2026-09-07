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

export interface MindmapLayoutMetrics {
  totalEdgeLength: number;
  meanBranchRadius: number;
  nodeCoverageRatio: number;
  branchSpread: number;
  branchOverlap: number;
}

export interface MindmapDensityEstimate {
  occupiedNodeArea: number;
  totalCanvasArea: number;
  averageBranchSpread: number;
  edgeToNodeRatio: number;
  estimatedCoverage: number;
  densityScore: number;
  targetCoverage: number;
  scaleAdjustment: number;
}

export interface MindmapBranchCluster {
  branchId: string;
  rootId: string;
  nodeIds: string[];
  nodeCount: number;
  totalNodeArea: number;
  subtreeDepth: number;
  longestLabelWidth: number;
  weight: number;
  angleStart: number;
  angleEnd: number;
  angle: number;
}

export interface MindmapBranchClusterLayoutPlan {
  rootId: string;
  clusters: MindmapBranchCluster[];
  totalWeight: number;
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
  nodeWidthScale: 1.5,
  nodeHeightScale: 1.5,
  nodePaddingScale: 1.35,
  siblingGapScale: 1.1,
  levelGapScale: 1.05,
  textScale: 1,
};

export async function layoutMindmapWithElkRaw(
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

export async function layoutMindmapWithElk(
  mindmap: GeneratedMindmap,
): Promise<MindmapLayoutResult> {
  const rawLayout = await layoutMindmapWithElkRaw(mindmap);
  return applyBranchClusterPostPass(mindmap, rawLayout);
}

export function buildMindmapBranchClusterPlan(
  mindmap: GeneratedMindmap,
): MindmapBranchClusterLayoutPlan {
  const branchNodes = mindmap.nodes.filter((node) => node.kind === 'branch');
  const orderedBranches = [...branchNodes].sort((left, right) => {
    const leftIndex = mindmap.metadata.branchOrder.indexOf(left.id);
    const rightIndex = mindmap.metadata.branchOrder.indexOf(right.id);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.id.localeCompare(right.id);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });

  const clusters: MindmapBranchCluster[] = [];

  for (const branch of orderedBranches) {
    const nodeIds = collectSubtreeNodeIds(branch.id, mindmap.nodes);
    const totalNodeArea = mindmap.nodes
      .filter((node) => nodeIds.includes(node.id))
      .reduce((total, node) => {
        const nodeBoxWidth = node.layout.minWidth + node.layout.paddingX * 2;
        const nodeBoxHeight = node.layout.minHeight + node.layout.paddingY * 2;
        return total + nodeBoxWidth * nodeBoxHeight;
      }, 0);
    const subtreeDepth = Math.max(
      ...mindmap.nodes
        .filter((node) => nodeIds.includes(node.id))
        .map((node) => node.level - branch.level + 1),
      1,
    );
    const longestLabelWidth = Math.max(
      ...mindmap.nodes
        .filter((node) => nodeIds.includes(node.id))
        .map((node) => node.label.length * 8 + 24),
      1,
    );
    const weight = nodeIds.length * 1.4 + totalNodeArea / 160 + subtreeDepth * 8 + longestLabelWidth / 10;

    clusters.push({
      branchId: branch.id,
      rootId: branch.id,
      nodeIds,
      nodeCount: nodeIds.length,
      totalNodeArea,
      subtreeDepth,
      longestLabelWidth,
      weight,
      angleStart: 0,
      angleEnd: 0,
      angle: 0,
    });
  }

  const totalWeight = clusters.reduce((total, cluster) => total + cluster.weight, 0);
  let currentAngle = 0;

  for (const cluster of clusters) {
    const span = totalWeight > 0 ? (cluster.weight / totalWeight) * (Math.PI * 2 * 0.8) : 0;
    cluster.angleStart = currentAngle;
    cluster.angleEnd = currentAngle + span;
    cluster.angle = cluster.angleStart + span / 2;
    currentAngle = cluster.angleEnd + (Math.PI * 2 * 0.2) / Math.max(clusters.length, 1);
  }

  return {
    rootId: mindmap.metadata.rootId,
    clusters,
    totalWeight,
  };
}

function applyBranchClusterPostPass(
  mindmap: GeneratedMindmap,
  layout: MindmapLayoutResult,
): MindmapLayoutResult {
  const plan = buildMindmapBranchClusterPlan(mindmap);
  if (plan.clusters.length < 2) {
    return layout;
  }

  const adjustedNodes = layout.nodes.map((node) => ({ ...node }));
  const rootNode = adjustedNodes.find((node) => node.id === mindmap.metadata.rootId);

  if (!rootNode) {
    return layout;
  }

  const rootCenter = {
    x: rootNode.x + rootNode.width / 2,
    y: rootNode.y + rootNode.height / 2,
  };
  const clusterByNodeId = new Map<string, MindmapBranchCluster>();

  for (const cluster of plan.clusters) {
    for (const nodeId of cluster.nodeIds) {
      clusterByNodeId.set(nodeId, cluster);
    }
  }

  const compactnessScale = clampNumber(0.82 + (plan.clusters.length - 2) * 0.04, 0.74, 0.88);

  for (const cluster of plan.clusters) {
    const branchNode = adjustedNodes.find((node) => node.id === cluster.branchId);

    if (!branchNode || branchNode.id === rootNode.id) {
      continue;
    }

    const branchCenter = {
      x: branchNode.x + branchNode.width / 2,
      y: branchNode.y + branchNode.height / 2,
    };
    const offset = {
      x: branchCenter.x - rootCenter.x,
      y: branchCenter.y - rootCenter.y,
    };
    const distance = Math.hypot(offset.x, offset.y) || 1;
    const direction = {
      x: offset.x / distance,
      y: offset.y / distance,
    };
    const clusterPreference = clampNumber(
      1 - cluster.nodeCount / Math.max(plan.totalWeight, 1) * 0.16,
      0.72,
      0.9,
    );
    const targetDistance = Math.max(48, distance * compactnessScale * clusterPreference);
    const targetCenter = {
      x: rootCenter.x + direction.x * targetDistance,
      y: rootCenter.y + direction.y * targetDistance,
    };
    const translation = {
      x: targetCenter.x - branchCenter.x,
      y: targetCenter.y - branchCenter.y,
    };

    for (const nodeId of cluster.nodeIds) {
      const node = adjustedNodes.find((candidate) => candidate.id === nodeId);

      if (!node) {
        continue;
      }

      node.x += translation.x;
      node.y += translation.y;
    }
  }

  resolveRadialNodeOverlap(adjustedNodes, rootCenter);

  const minX = Math.min(...adjustedNodes.map((node) => node.x), rootNode.x);
  const maxX = Math.max(
    ...adjustedNodes.map((node) => node.x + node.width),
    rootNode.x + rootNode.width,
  );
  const minY = Math.min(...adjustedNodes.map((node) => node.y), rootNode.y);
  const maxY = Math.max(
    ...adjustedNodes.map((node) => node.y + node.height),
    rootNode.y + rootNode.height,
  );
  const width = maxX - minX;
  const height = maxY - minY;

  const nodesById = new Map(adjustedNodes.map((node) => [node.id, node]));
  const edges = mindmap.edges.map((edge) => {
    const sourceNode = nodesById.get(edge.from);
    const targetNode = nodesById.get(edge.to);

    if (!sourceNode || !targetNode) {
      return {
        id: edge.id,
        points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      };
    }

    return {
      id: edge.id,
      points: [
        {
          x: sourceNode.x + sourceNode.width / 2,
          y: sourceNode.y + sourceNode.height / 2,
        },
        {
          x: targetNode.x + targetNode.width / 2,
          y: targetNode.y + targetNode.height / 2,
        },
      ],
    };
  });

  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    nodes: adjustedNodes,
    edges,
  };
}

function resolveRadialNodeOverlap(
  nodes: MindmapLayoutNode[],
  rootCenter: { x: number; y: number },
): void {
  for (let pass = 0; pass < 20; pass += 1) {
    let moved = false;

    for (let index = 0; index < nodes.length; index += 1) {
      for (let comparisonIndex = index + 1; comparisonIndex < nodes.length; comparisonIndex += 1) {
        const left = nodes[index];
        const right = nodes[comparisonIndex];

        if (!rectsOverlap(left, right)) {
          continue;
        }

        moved = true;
        const leftCenter = { x: left.x + left.width / 2, y: left.y + left.height / 2 };
        const rightCenter = { x: right.x + right.width / 2, y: right.y + right.height / 2 };
        const dx = leftCenter.x - rightCenter.x;
        const dy = leftCenter.y - rightCenter.y;
        const overlapX = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
        const overlapY = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);
        const pushX = Math.max(overlapX / 2 + 2, 2);
        const pushY = Math.max(overlapY / 2 + 2, 2);

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            if (dx >= 0) {
              left.x += pushX;
              right.x -= pushX;
            } else {
              left.x -= pushX;
              right.x += pushX;
            }
          } else if (dy >= 0) {
            left.y += pushY;
            right.y -= pushY;
          } else {
            left.y -= pushY;
            right.y += pushY;
          }
        } else if (overlapX > 0) {
          if (dx >= 0) {
            left.x += pushX;
            right.x -= pushX;
          } else {
            left.x -= pushX;
            right.x += pushX;
          }
        } else if (dy >= 0) {
          left.y += pushY;
          right.y -= pushY;
        } else {
          left.y -= pushY;
          right.y += pushY;
        }

        const leftPolarRadius = Math.hypot(leftCenter.x - rootCenter.x, leftCenter.y - rootCenter.y) || 1;
        const rightPolarRadius = Math.hypot(rightCenter.x - rootCenter.x, rightCenter.y - rootCenter.y) || 1;
        const minAllowedRadius = Math.min(leftPolarRadius, rightPolarRadius) * 0.98;

        if (leftPolarRadius < minAllowedRadius) {
          const leftAngle = Math.atan2(leftCenter.y - rootCenter.y, leftCenter.x - rootCenter.x);
          left.x = rootCenter.x + Math.cos(leftAngle) * minAllowedRadius - left.width / 2;
          left.y = rootCenter.y + Math.sin(leftAngle) * minAllowedRadius - left.height / 2;
        }

        if (rightPolarRadius < minAllowedRadius) {
          const rightAngle = Math.atan2(rightCenter.y - rootCenter.y, rightCenter.x - rootCenter.x);
          right.x = rootCenter.x + Math.cos(rightAngle) * minAllowedRadius - right.width / 2;
          right.y = rootCenter.y + Math.sin(rightAngle) * minAllowedRadius - right.height / 2;
        }
      }
    }

    if (!moved) {
      break;
    }
  }
}

function rectsOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function doesNodeOverlapAny(
  candidate: { x: number; y: number },
  width: number,
  height: number,
  placedNodes: Array<{ id: string; x: number; y: number; width: number; height: number }>,
): boolean {
  return placedNodes.some((node) =>
    candidate.x < node.x + node.width &&
    candidate.x + width > node.x &&
    candidate.y < node.y + node.height &&
    candidate.y + height > node.y,
  );
}

export function computeMindmapLayoutMetrics(
  mindmap: GeneratedMindmap,
  layout: MindmapLayoutResult,
): MindmapLayoutMetrics {
  const rootNode = layout.nodes.find((node) => node.id === mindmap.metadata.rootId) ?? null;
  const rootCenter = rootNode
    ? { x: rootNode.x + rootNode.width / 2, y: rootNode.y + rootNode.height / 2 }
    : { x: layout.width / 2, y: layout.height / 2 };

  const branchNodeIds = new Set(
    mindmap.nodes.filter((node) => node.kind === 'branch').map((node) => node.id),
  );
  const branchCenters = layout.nodes
    .filter((node) => branchNodeIds.has(node.id))
    .map((node) => ({
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
    }));

  const totalEdgeLength = layout.edges.reduce((total, edge) => {
    if (edge.points.length < 2) {
      return total;
    }

    let edgeLength = 0;

    for (let index = 1; index < edge.points.length; index += 1) {
      const previousPoint = edge.points[index - 1];
      const currentPoint = edge.points[index];
      edgeLength += Math.hypot(
        currentPoint.x - previousPoint.x,
        currentPoint.y - previousPoint.y,
      );
    }

    return total + edgeLength;
  }, 0);

  const meanBranchRadius = branchCenters.length
    ? branchCenters.reduce(
        (total, center) => total + Math.hypot(center.x - rootCenter.x, center.y - rootCenter.y),
        0,
      ) / branchCenters.length
    : 0;

  const totalNodeArea = layout.nodes.reduce((total, node) => total + node.width * node.height, 0);
  const canvasArea = Math.max(layout.width * layout.height, 1);
  const nodeCoverageRatio = totalNodeArea / canvasArea;

  const branchSpread = branchCenters.length
    ? branchCenters.reduce(
        (total, center) => total + Math.hypot(center.x - rootCenter.x, center.y - rootCenter.y),
        0,
      ) / branchCenters.length
    : 0;

  const branchOverlap = countOverlappingNodePairs(layout.nodes);

  return {
    totalEdgeLength,
    meanBranchRadius,
    nodeCoverageRatio,
    branchSpread,
    branchOverlap,
  };
}

function countOverlappingNodePairs(nodes: MindmapLayoutNode[]): number {
  let overlaps = 0;

  for (let index = 0; index < nodes.length; index += 1) {
    for (let comparisonIndex = index + 1; comparisonIndex < nodes.length; comparisonIndex += 1) {
      const left = nodes[index];
      const right = nodes[comparisonIndex];
      const intersects =
        left.x < right.x + right.width &&
        left.x + left.width > right.x &&
        left.y < right.y + right.height &&
        left.y + left.height > right.y;

      if (intersects) {
        overlaps += 1;
      }
    }
  }

  return overlaps;
}

export function estimateMindmapDensity(
  mindmap: GeneratedMindmap,
  layoutOverride?: MindmapLayoutResult,
): MindmapDensityEstimate {
  const occupiedNodeArea = mindmap.nodes.reduce((total, node) => {
    const nodeWidth = node.layout.minWidth + node.layout.paddingX * 2;
    const nodeHeight = node.layout.minHeight + node.layout.paddingY * 2;
    return total + nodeWidth * nodeHeight;
  }, 0);

  const branchNodes = mindmap.nodes.filter((node) => node.kind === 'branch');
  const branchSpread =
    branchNodes.length > 0
      ? branchNodes.reduce((total, node) => {
          const width = node.layout.minWidth + node.layout.paddingX * 2;
          const height = node.layout.minHeight + node.layout.paddingY * 2;
          const spread = Math.hypot(width, height) + node.level * mindmap.metadata.layout.levelGap;
          return total + spread;
        }, 0) / branchNodes.length
      : 0;

  const totalCanvasArea = layoutOverride
    ? Math.max(layoutOverride.width * layoutOverride.height, 1)
    : Math.max(
        Math.PI *
          Math.pow(
            Math.max(
              mindmap.metadata.layout.levelGap * (Math.max(branchNodes.length, 1) + 1),
              estimateMindmapNodeArea(mindmap),
            ),
            2,
          ) * 1.25,
        occupiedNodeArea * 2.5,
      );

  const edgeToNodeRatio = mindmap.edges.length / Math.max(mindmap.nodes.length, 1);
  const estimatedCoverage = totalCanvasArea > 0 ? occupiedNodeArea / totalCanvasArea : 0;
  const targetCoverage = 0.5;
  const coverageDistance = Math.abs(estimatedCoverage - targetCoverage) / Math.max(targetCoverage, 0.01);
  const spreadSignal = clampNumber(branchSpread / Math.max(Math.sqrt(totalCanvasArea), 1), 0, 1);
  const complexitySignal = clampNumber(edgeToNodeRatio / 2.5, 0, 1);
  const densityScore = clampNumber(
    0.7 * (1 - coverageDistance) + 0.2 * (1 - spreadSignal) + 0.1 * complexitySignal,
    0,
    1,
  );
  const scaleAdjustment = clampNumber(
    1 + (targetCoverage - estimatedCoverage) * 1.8 + (1 - densityScore) * 0.18 + spreadSignal * 0.12,
    0.7,
    1.35,
  );

  return {
    occupiedNodeArea,
    totalCanvasArea,
    averageBranchSpread: branchSpread,
    edgeToNodeRatio,
    estimatedCoverage,
    densityScore,
    targetCoverage,
    scaleAdjustment,
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
  const densityProfile = estimateMindmapDensity(mindmap);
  const densityAdaptiveScale = densityProfile.scaleAdjustment;
  const spacingAdaptiveScale = clampNumber(
    1 + (densityProfile.targetCoverage - densityProfile.estimatedCoverage) * 0.9,
    0.72,
    1.22,
  );
  const textDrivenBoxScale = scaleWithTextInfluence(exportScale.textScale, 0.45);
  const textDrivenPaddingScale = scaleWithTextInfluence(exportScale.textScale, 0.32);
  const widthScaleCeiling = Math.max(1.5, exportScale.textScale * 0.98);
  const heightScaleCeiling = Math.max(1.5, exportScale.textScale * 0.98);
  const paddingScaleCeiling = Math.max(1.35, exportScale.textScale * 0.98);

  // Manual sliders are overrides on top of the deterministic density model.
  // They tune the export variant, but never replace the underlying cluster-based layout.
  const effectiveWidthScale = clampNumber(
    exportScale.nodeWidthScale * densityAdaptiveScale * textDrivenBoxScale,
    1.05,
    widthScaleCeiling,
  );
  const effectiveHeightScale = clampNumber(
    exportScale.nodeHeightScale * densityAdaptiveScale * textDrivenBoxScale,
    1.05,
    heightScaleCeiling,
  );
  const effectivePaddingScale = clampNumber(
    exportScale.nodePaddingScale * densityAdaptiveScale * textDrivenPaddingScale,
    1.05,
    paddingScaleCeiling,
  );

  return {
    ...mindmap,
    metadata: {
      ...mindmap.metadata,
      layout: {
        ...mindmap.metadata.layout,
        levelGap: scalePositiveInt(
          mindmap.metadata.layout.levelGap,
          exportScale.levelGapScale * spacingAdaptiveScale,
        ),
        siblingGap: scalePositiveInt(
          mindmap.metadata.layout.siblingGap,
          exportScale.siblingGapScale * spacingAdaptiveScale,
        ),
        branchGap: scalePositiveInt(
          mindmap.metadata.layout.branchGap,
          exportScale.siblingGapScale * spacingAdaptiveScale,
        ),
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
        siblingGap: scalePositiveInt(
          node.layout.siblingGap,
          exportScale.siblingGapScale * spacingAdaptiveScale,
        ),
      },
    })),
    edges: mindmap.edges.map((edge) => ({ ...edge })),
    warnings: [...mindmap.warnings],
    errors: [...mindmap.errors],
  };
}

function collectSubtreeNodeIds(
  rootId: string,
  nodes: GeneratedMindmap['nodes'],
  visited = new Set<string>(),
): string[] {
  if (visited.has(rootId)) {
    return [];
  }

  visited.add(rootId);
  const rootNode = nodes.find((node) => node.id === rootId);

  if (!rootNode) {
    return [];
  }

  const descendants = rootNode.childIds.flatMap((childId) => collectSubtreeNodeIds(childId, nodes, visited));
  return [rootId, ...descendants];
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

function estimateMindmapNodeArea(mindmap: GeneratedMindmap): number {
  return mindmap.nodes.reduce((total, node) => {
    const width = node.layout.minWidth + node.layout.paddingX * 2;
    const height = node.layout.minHeight + node.layout.paddingY * 2;
    return total + width * height;
  }, 0);
}

function scalePositiveInt(value: number, factor: number): number {
  return Math.max(1, Math.ceil(value * factor));
}

function scaleNonNegativeInt(value: number, factor: number): number {
  return Math.max(0, Math.ceil(value * factor));
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function scaleWithTextInfluence(textScale: number, influence: number): number {
  if (textScale <= 1) {
    return textScale;
  }

  return 1 + (textScale - 1) * influence;
}