import { getMindmapTintTone } from '../mindmap/palette.ts';
import type { GeneratedMindmap, MindmapEdge, MindmapNode } from '../mindmap/schema.ts';
import type { MindmapGenerationResponse } from './schema.ts';

export function mergeDeterministicMindmapWithOverlay(
  deterministicMindmap: GeneratedMindmap,
  overlay: MindmapGenerationResponse,
): GeneratedMindmap {
  const mindmap = cloneGeneratedMindmap(deterministicMindmap);
  const nodeMap = new Map(mindmap.nodes.map((node) => [node.id, node]));

  mindmap.metadata.title = overlay.title;

  for (const rewrite of overlay.labelRewrites) {
    const node = nodeMap.get(rewrite.nodeId);

    if (!node) {
      continue;
    }

    node.label = rewrite.label;
  }

  for (const grouping of overlay.groupingSuggestions) {
    applyGroupingSuggestion(mindmap, nodeMap, grouping);
  }

  return mindmap;
}

function applyGroupingSuggestion(
  mindmap: GeneratedMindmap,
  nodeMap: Map<string, MindmapNode>,
  grouping: MindmapGenerationResponse['groupingSuggestions'][number],
): void {
  const parentNode = nodeMap.get(grouping.parentNodeId);

  if (!parentNode) {
    return;
  }

  const selectedChildren = grouping.childNodeIds
    .map((childId) => nodeMap.get(childId))
    .filter((child): child is MindmapNode => Boolean(child) && child.parentId === parentNode.id);

  if (selectedChildren.length !== grouping.childNodeIds.length) {
    return;
  }

  const firstChildIndex = parentNode.childIds.findIndex((childId) => childId === grouping.childNodeIds[0]);

  if (firstChildIndex < 0) {
    return;
  }

  const groupNodeId = createSyntheticGroupNodeId(nodeMap, parentNode.id, grouping.groupLabel);
  const groupLevel = parentNode.level + 1;
  const branchIndex = selectedChildren[0]?.style?.branchIndex;
  const colorToken = selectedChildren[0]?.style?.colorToken;
  const baseLayout = selectedChildren[0]?.layout;
  const groupNode: MindmapNode = {
    id: groupNodeId,
    kind: 'leaf',
    label: grouping.groupLabel,
    level: groupLevel,
    parentId: parentNode.id,
    branchId: parentNode.branchId,
    childIds: grouping.childNodeIds,
    layout: {
      minWidth: Math.max(baseLayout?.minWidth ?? 156, grouping.groupLabel.length * 8 + 100),
      minHeight: baseLayout?.minHeight ?? 60,
      paddingX: baseLayout?.paddingX ?? 20,
      paddingY: baseLayout?.paddingY ?? 14,
      siblingGap: baseLayout?.siblingGap ?? 44,
    },
    style: colorToken == null || branchIndex == null
      ? undefined
      : {
          branchKey: parentNode.branchId,
          branchIndex,
          colorToken,
          tintTone: getMindmapTintTone(groupLevel),
        },
  };

  nodeMap.set(groupNode.id, groupNode);
  mindmap.nodes.push(groupNode);

  parentNode.childIds = parentNode.childIds.filter((childId) => !grouping.childNodeIds.includes(childId));
  parentNode.childIds.splice(firstChildIndex, 0, groupNode.id);

  for (const childNode of selectedChildren) {
    childNode.parentId = groupNode.id;
    incrementNodeDepth(nodeMap, childNode.id);
  }

  mindmap.edges = mindmap.edges.filter(
    (edge) => !(edge.from === parentNode.id && grouping.childNodeIds.includes(edge.to)),
  );
  mindmap.edges.push(createEdge(parentNode.id, groupNode.id));
  grouping.childNodeIds.forEach((childNodeId) => {
    mindmap.edges.push(createEdge(groupNode.id, childNodeId));
  });
}

function incrementNodeDepth(nodeMap: Map<string, MindmapNode>, nodeId: string): void {
  const node = nodeMap.get(nodeId);

  if (!node) {
    return;
  }

  node.level += 1;

  if (node.style?.branchIndex != null && node.style?.colorToken != null) {
    node.style.tintTone = getMindmapTintTone(node.level);
  }

  node.childIds.forEach((childId) => {
    incrementNodeDepth(nodeMap, childId);
  });
}

function createSyntheticGroupNodeId(
  nodeMap: Map<string, MindmapNode>,
  parentId: string,
  groupLabel: string,
): string {
  const baseSlug = groupLabel
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'group';
  let candidate = `${parentId}-group-${baseSlug}`;
  let suffix = 2;

  while (nodeMap.has(candidate)) {
    candidate = `${parentId}-group-${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function createEdge(from: string, to: string): MindmapEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
  };
}

function cloneGeneratedMindmap(mindmap: GeneratedMindmap): GeneratedMindmap {
  return JSON.parse(JSON.stringify(mindmap)) as GeneratedMindmap;
}