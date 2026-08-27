import { z } from 'zod';

import type { MindmapLayoutResult } from './layout.ts';
import type { GeneratedMindmap } from './schema.ts';

export const mindmapNodeOffsetSchema = z
  .object({
    dx: z.number(),
    dy: z.number(),
  })
  .strict();

export const mindmapNodePositionOverridesSchema = z.record(
  z.string(),
  mindmapNodeOffsetSchema,
);

export type MindmapNodeOffset = z.infer<typeof mindmapNodeOffsetSchema>;
export type MindmapNodePositionOverrides = z.infer<typeof mindmapNodePositionOverridesSchema>;

// Overrides are stored per dragged node; a node's effective offset is the sum
// of its own override and every ancestor's, so dragging a node carries its
// whole subtree and later parent drags compose with earlier child drags.
export function applyMindmapNodePositionOverrides(
  mindmap: GeneratedMindmap,
  layoutResult: MindmapLayoutResult,
  overrides: MindmapNodePositionOverrides,
  options: { scaleX?: number; scaleY?: number } = {},
): MindmapLayoutResult {
  if (Object.keys(overrides).length === 0) {
    return layoutResult;
  }

  const scaleX = options.scaleX ?? 1;
  const scaleY = options.scaleY ?? 1;
  const parentIds = new Map(mindmap.nodes.map((node) => [node.id, node.parentId]));
  const offsetCache = new Map<string, MindmapNodeOffset>();

  function resolveOffset(nodeId: string): MindmapNodeOffset {
    const cached = offsetCache.get(nodeId);

    if (cached) {
      return cached;
    }

    let dx = 0;
    let dy = 0;
    const visited = new Set<string>();
    let currentId: string | null | undefined = nodeId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const override = overrides[currentId];

      if (override) {
        dx += override.dx;
        dy += override.dy;
      }

      currentId = parentIds.get(currentId);
    }

    const offset = { dx: dx * scaleX, dy: dy * scaleY };
    offsetCache.set(nodeId, offset);
    return offset;
  }

  const nodes = layoutResult.nodes.map((node) => {
    const offset = resolveOffset(node.id);

    if (offset.dx === 0 && offset.dy === 0) {
      return node;
    }

    return { ...node, x: node.x + offset.dx, y: node.y + offset.dy };
  });

  const layoutNodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edgeEndpoints = new Map(mindmap.edges.map((edge) => [edge.id, edge]));

  const edges = layoutResult.edges.map((edge) => {
    const endpoints = edgeEndpoints.get(edge.id);

    if (!endpoints) {
      return edge;
    }

    const fromOffset = resolveOffset(endpoints.from);
    const toOffset = resolveOffset(endpoints.to);
    const isStationary =
      fromOffset.dx === 0 && fromOffset.dy === 0 && toOffset.dx === 0 && toOffset.dy === 0;

    if (isStationary) {
      return edge;
    }

    // Both endpoints moved together: the routed points stay valid, translated.
    if (fromOffset.dx === toOffset.dx && fromOffset.dy === toOffset.dy) {
      return {
        ...edge,
        points: edge.points.map((point) => ({
          x: point.x + fromOffset.dx,
          y: point.y + fromOffset.dy,
        })),
      };
    }

    const fromNode = layoutNodeMap.get(endpoints.from);
    const toNode = layoutNodeMap.get(endpoints.to);

    if (!fromNode || !toNode) {
      return edge;
    }

    // Endpoints moved apart: re-route as a simple center-to-center curve.
    return {
      ...edge,
      points: [
        { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 },
        { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 },
      ],
    };
  });

  let width = layoutResult.width;
  let height = layoutResult.height;

  for (const node of nodes) {
    width = Math.max(width, node.x + node.width);
    height = Math.max(height, node.y + node.height);
  }

  for (const edge of edges) {
    for (const point of edge.points) {
      width = Math.max(width, point.x);
      height = Math.max(height, point.y);
    }
  }

  return { width, height, nodes, edges };
}

export function pruneMindmapNodePositionOverrides(
  overrides: MindmapNodePositionOverrides,
  mindmap: GeneratedMindmap | null,
): MindmapNodePositionOverrides {
  if (!mindmap) {
    return overrides;
  }

  const knownIds = new Set(mindmap.nodes.map((node) => node.id));
  const pruned: MindmapNodePositionOverrides = {};

  for (const [nodeId, offset] of Object.entries(overrides)) {
    if (knownIds.has(nodeId) && (offset.dx !== 0 || offset.dy !== 0)) {
      pruned[nodeId] = offset;
    }
  }

  return pruned;
}
