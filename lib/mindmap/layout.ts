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

export interface MindmapLayoutWorkerRequest {
  type: 'layout';
  mindmap: GeneratedMindmap;
}

export interface MindmapLayoutWorkerSuccess {
  type: 'layout-success';
  result: MindmapLayoutResult;
}

export interface MindmapLayoutWorkerFailure {
  type: 'layout-error';
  message: string;
}

export type MindmapLayoutWorkerResponse =
  | MindmapLayoutWorkerSuccess
  | MindmapLayoutWorkerFailure;

const elk = new ELK();

export async function layoutMindmapWithElk(
  mindmap: GeneratedMindmap,
): Promise<MindmapLayoutResult> {
  const elkGraph = translateMindmapToElkGraph(mindmap);
  const laidOutGraph = await elk.layout({
    ...elkGraph,
    layoutOptions: {
      'elk.algorithm': 'radial',
    },
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

function collectEdgePoints(edge: NonNullable<ElkNode['edges']>[number]): ElkPoint[] {
  const section = edge.sections?.[0];

  if (!section) {
    return [];
  }

  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
}