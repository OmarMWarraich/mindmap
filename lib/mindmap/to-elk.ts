import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';

import type { GeneratedMindmap, MindmapNode } from './schema.ts';

export interface MindmapElkNode extends ElkNode {
  id: string;
}

export function translateMindmapToElkGraph(mindmap: GeneratedMindmap): MindmapElkNode {
  const nodeIndex = new Map(mindmap.nodes.map((node) => [node.id, node]));

  return {
    id: mindmap.metadata.rootId,
    children: mindmap.nodes.map((node) => createElkNode(node)),
    edges: mindmap.edges.map((edge) => createElkEdge(edge.id, edge.from, edge.to, nodeIndex)),
  };
}

function createElkNode(node: MindmapNode): MindmapElkNode {
  return {
    id: node.id,
    width: node.layout.minWidth + node.layout.paddingX * 2,
    height: node.layout.minHeight + node.layout.paddingY * 2,
  };
}

function createElkEdge(
  id: string,
  sourceId: string,
  targetId: string,
  nodeIndex: Map<string, MindmapNode>,
): ElkExtendedEdge {
  if (!nodeIndex.has(sourceId)) {
    throw new Error(`Cannot create ELK edge "${id}" because source node "${sourceId}" is missing.`);
  }

  if (!nodeIndex.has(targetId)) {
    throw new Error(`Cannot create ELK edge "${id}" because target node "${targetId}" is missing.`);
  }

  return {
    id,
    sources: [sourceId],
    targets: [targetId],
  };
}