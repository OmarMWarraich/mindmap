import assert from 'node:assert/strict';
import test from 'node:test';

import { generateMindmapFromAst } from './from-ast.ts';
import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';
import {
  createExportMindmapVariant,
  createMindmapRadialLayoutOptions,
  layoutMindmapWithElk,
} from './layout.ts';

test('createMindmapRadialLayoutOptions maps generation spacing hints to ELK radial options', () => {
  assert.deepEqual(createMindmapRadialLayoutOptions(validGeneratedMindmapFixture), {
    'elk.algorithm': 'radial',
    'org.eclipse.elk.radial.centerOnRoot': 'true',
    'org.eclipse.elk.radial.compactor': 'WEDGE_COMPACTION',
    'org.eclipse.elk.radial.compactionStepSize': '2',
    'org.eclipse.elk.radial.wedgeCriteria': 'NODE_SIZE',
    'org.eclipse.elk.radial.radius': '366',
    'org.eclipse.elk.radial.rotation.computeAdditionalWedgeSpace': 'true',
    'org.eclipse.elk.spacing.nodeNode': '52',
    'org.eclipse.elk.padding': '[top=48,left=48,bottom=48,right=48]',
  });
});

test('layoutMindmapWithElk returns positioned nodes and routed edges', async () => {
  const result = await layoutMindmapWithElk(validGeneratedMindmapFixture);

  assert.equal(result.nodes.length, validGeneratedMindmapFixture.nodes.length);
  assert.equal(result.edges.length, validGeneratedMindmapFixture.edges.length);
  assert.equal(result.width > 0, true);
  assert.equal(result.height > 0, true);
  assert.equal(result.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), true);
  assert.equal(result.edges.every((edge) => edge.points.length >= 2), true);
});

test('createExportMindmapVariant scales node boxes and spacing for export layout', () => {
  const exportMindmap = createExportMindmapVariant(validGeneratedMindmapFixture);

  assert.equal(
    exportMindmap.nodes[0]!.layout.minWidth > validGeneratedMindmapFixture.nodes[0]!.layout.minWidth,
    true,
  );
  assert.equal(
    exportMindmap.nodes[0]!.layout.minHeight > validGeneratedMindmapFixture.nodes[0]!.layout.minHeight,
    true,
  );
  assert.equal(
    exportMindmap.nodes[0]!.layout.paddingX > validGeneratedMindmapFixture.nodes[0]!.layout.paddingX,
    true,
  );
  assert.equal(
    exportMindmap.metadata.layout.levelGap > validGeneratedMindmapFixture.metadata.layout.levelGap,
    true,
  );
});

test('layoutMindmapWithElk avoids node overlap in dense radial layouts', async () => {
  const denseMindmap = generateMindmapFromAst({
    root: {
      id: 'root-law',
      kind: 'root',
      label: 'Law',
      source: {
        line: 1,
        column: 1,
        indentLevel: 0,
        raw: '@root: Law',
      },
      branches: ['Public law', 'Private law', 'Criminal law', 'Procedure law'].map((branch, branchIndex) => ({
        id: `branch-${branchIndex + 1}`,
        kind: 'branch',
        label: branch,
        source: {
          line: branchIndex + 2,
          column: 1,
          indentLevel: 0,
          raw: `- @branch: ${branch}`,
        },
        children: Array.from({ length: 12 }, (_, childIndex) => ({
          id: `leaf-${branchIndex + 1}-${childIndex + 1}`,
          kind: 'leaf',
          label: `${branch} leaf ${childIndex + 1} discussing judicial review remedies precedent interpretation and balancing tests under complex factual matrices`,
          source: {
            line: 20 + branchIndex * 20 + childIndex,
            column: 3,
            indentLevel: 1,
            raw: `  - ${branch} leaf ${childIndex + 1}`,
          },
          children: [],
        })),
      })),
    },
  });

  const result = await layoutMindmapWithElk(denseMindmap);

  assert.deepEqual(findOverlappingNodePairs(result.nodes), []);
});

function findOverlappingNodePairs(
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>,
): string[] {
  const overlaps: string[] = [];

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
        overlaps.push(`${left.id}->${right.id}`);
      }
    }
  }

  return overlaps;
}