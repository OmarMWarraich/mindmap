import assert from 'node:assert/strict';
import test from 'node:test';

import { generateMindmapFromAst } from './from-ast.ts';
import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';
import {
  buildMindmapBranchClusterPlan,
  computeMindmapLayoutMetrics,
  createExportMindmapVariant,
  createMindmapRadialLayoutOptions,
  estimateMindmapDensity,
  layoutMindmapWithElk,
  layoutMindmapWithElkRaw,
} from './layout.ts';

test('createMindmapRadialLayoutOptions maps generation spacing hints to ELK radial options', () => {
  assert.deepEqual(createMindmapRadialLayoutOptions(validGeneratedMindmapFixture), {
    'elk.algorithm': 'radial',
    'org.eclipse.elk.radial.centerOnRoot': 'true',
    'org.eclipse.elk.radial.compactor': 'WEDGE_COMPACTION',
    'org.eclipse.elk.radial.compactionStepSize': '2',
    'org.eclipse.elk.radial.wedgeCriteria': 'NODE_SIZE',
    'org.eclipse.elk.radial.radius': '542',
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

test('computeMindmapLayoutMetrics exposes the current radial baseline for density and spread', async () => {
  const result = await layoutMindmapWithElk(validGeneratedMindmapFixture);
  const metrics = computeMindmapLayoutMetrics(validGeneratedMindmapFixture, result);

  assert.equal(Number.isFinite(metrics.totalEdgeLength), true);
  assert.equal(Number.isFinite(metrics.meanBranchRadius), true);
  assert.equal(Number.isFinite(metrics.nodeCoverageRatio), true);
  assert.equal(Number.isFinite(metrics.branchSpread), true);
  assert.equal(Number.isFinite(metrics.branchOverlap), true);
  assert.equal(metrics.totalEdgeLength > 0, true);
  assert.equal(metrics.meanBranchRadius > 0, true);
  assert.equal(metrics.nodeCoverageRatio > 0, true);
  assert.equal(metrics.nodeCoverageRatio < 0.55, true);
});

test('buildMindmapBranchClusterPlan groups branches into compact angular slots around the root', () => {
  const plan = buildMindmapBranchClusterPlan(validGeneratedMindmapFixture);

  assert.equal(plan.rootId, validGeneratedMindmapFixture.metadata.rootId);
  assert.equal(plan.clusters.length, 2);
  assert.equal(plan.totalWeight > 0, true);
  assert.equal(plan.clusters.every((cluster) => cluster.nodeIds.includes(cluster.rootId)), true);
  assert.equal(plan.clusters.every((cluster) => cluster.weight > 0), true);
  assert.equal(plan.clusters.every((cluster) => cluster.angleStart >= 0), true);
  assert.equal(plan.clusters.every((cluster) => cluster.angleEnd > cluster.angleStart), true);
  assert.equal(plan.clusters.every((cluster) => cluster.angle >= cluster.angleStart), true);
  assert.equal(plan.clusters.every((cluster) => cluster.angle <= cluster.angleEnd), true);
});

test('estimateMindmapDensity measures occupancy, spread, and edge density for auto-fit', () => {
  const density = estimateMindmapDensity(validGeneratedMindmapFixture);

  assert.equal(Number.isFinite(density.occupiedNodeArea), true);
  assert.equal(Number.isFinite(density.totalCanvasArea), true);
  assert.equal(Number.isFinite(density.averageBranchSpread), true);
  assert.equal(Number.isFinite(density.edgeToNodeRatio), true);
  assert.equal(Number.isFinite(density.estimatedCoverage), true);
  assert.equal(Number.isFinite(density.densityScore), true);
  assert.equal(density.estimatedCoverage > 0, true);
  assert.equal(density.densityScore >= 0, true);
  assert.equal(density.densityScore <= 1, true);
});

test('clustered layout keeps total edge length within a compact bounded range and reduces branch radius', async () => {
  const rawLayout = await layoutMindmapWithElkRaw(validGeneratedMindmapFixture);
  const clusteredLayout = await layoutMindmapWithElk(validGeneratedMindmapFixture);
  const rawMetrics = computeMindmapLayoutMetrics(validGeneratedMindmapFixture, rawLayout);
  const clusteredMetrics = computeMindmapLayoutMetrics(validGeneratedMindmapFixture, clusteredLayout);

  assert.equal(rawMetrics.totalEdgeLength > 0, true);
  assert.equal(clusteredMetrics.totalEdgeLength > 0, true);
  assert.equal(clusteredMetrics.totalEdgeLength < rawMetrics.totalEdgeLength * 3.5, true);
  assert.equal(clusteredMetrics.meanBranchRadius < rawMetrics.meanBranchRadius, true);
});

test('density fit expands occupied node area while staying inside the adaptive clamp', () => {
  const rawDensity = estimateMindmapDensity(validGeneratedMindmapFixture);
  const fittedDensity = estimateMindmapDensity(createExportMindmapVariant(validGeneratedMindmapFixture, {
    nodeWidthScale: 1.6,
    nodeHeightScale: 1.7,
    nodePaddingScale: 1.3,
    siblingGapScale: 1.25,
    levelGapScale: 1.2,
    textScale: 1.4,
  }));

  assert.equal(fittedDensity.occupiedNodeArea > rawDensity.occupiedNodeArea, true);
  assert.equal(fittedDensity.scaleAdjustment >= 1, true);
  assert.equal(fittedDensity.scaleAdjustment <= 1.35, true);
});

test('dense branch fixtures remain overlap-free after the clustered layout pass', async () => {
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

  const rawLayout = await layoutMindmapWithElkRaw(denseMindmap);
  const clusteredLayout = await layoutMindmapWithElk(denseMindmap);
  const rawMetrics = computeMindmapLayoutMetrics(denseMindmap, rawLayout);
  const clusteredMetrics = computeMindmapLayoutMetrics(denseMindmap, clusteredLayout);

  assert.equal(clusteredMetrics.branchOverlap, 0);
  assert.equal(clusteredMetrics.meanBranchRadius < rawMetrics.meanBranchRadius, true);
  assert.deepEqual(findOverlappingNodePairs(clusteredLayout.nodes), []);
});

test('large multi-branch trees keep compact branch spacing after clustering', async () => {
  const largeMindmap = generateMindmapFromAst({
    root: {
      id: 'root-compactness',
      kind: 'root',
      label: 'Research Portfolio',
      source: {
        line: 1,
        column: 1,
        indentLevel: 0,
        raw: '@root: Research Portfolio',
      },
      branches: Array.from({ length: 10 }, (_, branchIndex) => ({
        id: `branch-${branchIndex + 1}`,
        kind: 'branch',
        label: `Theme ${branchIndex + 1} exploring evidence, friction, adaptation, design, and policy outcomes`,
        source: {
          line: branchIndex + 2,
          column: 1,
          indentLevel: 0,
          raw: `- @branch: Theme ${branchIndex + 1}`,
        },
        children: Array.from({ length: 9 }, (_, childIndex) => ({
          id: `leaf-${branchIndex + 1}-${childIndex + 1}`,
          kind: 'leaf',
          label: `Leaf ${childIndex + 1} summarizing a major finding, test, evidence stream, and practical implication for decision-making`,
          source: {
            line: 20 + branchIndex * 20 + childIndex,
            column: 3,
            indentLevel: 1,
            raw: `  - Leaf ${childIndex + 1}`,
          },
          children: [],
        })),
      })),
    },
  });

  const rawLayout = await layoutMindmapWithElkRaw(largeMindmap);
  const clusteredLayout = await layoutMindmapWithElk(largeMindmap);
  const rawMetrics = computeMindmapLayoutMetrics(largeMindmap, rawLayout);
  const clusteredMetrics = computeMindmapLayoutMetrics(largeMindmap, clusteredLayout);

  assert.equal(clusteredMetrics.meanBranchRadius < rawMetrics.meanBranchRadius, true);
  assert.equal(clusteredMetrics.branchSpread <= rawMetrics.branchSpread, true);
  assert.equal(clusteredMetrics.nodeCoverageRatio > rawMetrics.nodeCoverageRatio, true);
  assert.deepEqual(findOverlappingNodePairs(clusteredLayout.nodes), []);
});

test('layoutMindmapWithElk reduces branch radius after the branch-cluster post-pass', async () => {
  const rawLayout = await layoutMindmapWithElkRaw(validGeneratedMindmapFixture);
  const clusteredLayout = await layoutMindmapWithElk(validGeneratedMindmapFixture);
  const rawMetrics = computeMindmapLayoutMetrics(validGeneratedMindmapFixture, rawLayout);
  const clusteredMetrics = computeMindmapLayoutMetrics(validGeneratedMindmapFixture, clusteredLayout);

  assert.equal(clusteredMetrics.meanBranchRadius < rawMetrics.meanBranchRadius, true);
  assert.equal(clusteredMetrics.nodeCoverageRatio > rawMetrics.nodeCoverageRatio, true);
  assert.equal(clusteredLayout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), true);
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

test('createExportMindmapVariant enlarges boxes further when text scale increases', () => {
  const exportMindmap = createExportMindmapVariant(validGeneratedMindmapFixture, {
    textScale: 1.5,
  });

  assert.equal(
    exportMindmap.nodes[0]!.layout.minWidth > validGeneratedMindmapFixture.nodes[0]!.layout.minWidth * 1.2,
    true,
  );
  assert.equal(
    exportMindmap.nodes[0]!.layout.minHeight > validGeneratedMindmapFixture.nodes[0]!.layout.minHeight * 1.2,
    true,
  );
});

test('createExportMindmapVariant grows text-driven boxes more slowly than text scale itself', () => {
  const exportMindmap = createExportMindmapVariant(validGeneratedMindmapFixture, {
    textScale: 2.5,
  });

  assert.equal(
    exportMindmap.nodes[0]!.layout.minWidth < validGeneratedMindmapFixture.nodes[0]!.layout.minWidth * 2.5,
    true,
  );
  assert.equal(
    exportMindmap.nodes[0]!.layout.minHeight < validGeneratedMindmapFixture.nodes[0]!.layout.minHeight * 2.5,
    true,
  );
});

test('manual export overrides only refine the density-adjusted layout and keep the layout deterministic', () => {
  const baseMindmap = createExportMindmapVariant(validGeneratedMindmapFixture);
  const overrideMindmap = createExportMindmapVariant(validGeneratedMindmapFixture, {
    nodeWidthScale: 1.8,
    nodeHeightScale: 1.7,
    nodePaddingScale: 1.5,
    siblingGapScale: 1.3,
    levelGapScale: 1.25,
    textScale: 1.6,
  });

  assert.equal(overrideMindmap.nodes[0]!.layout.minWidth > baseMindmap.nodes[0]!.layout.minWidth, true);
  assert.equal(overrideMindmap.nodes[0]!.layout.minHeight > baseMindmap.nodes[0]!.layout.minHeight, true);
  assert.equal(overrideMindmap.metadata.layout.levelGap > baseMindmap.metadata.layout.levelGap, true);
  assert.equal(overrideMindmap.metadata.layout.levelGap < baseMindmap.metadata.layout.levelGap * 1.5, true);
  assert.equal(
    overrideMindmap.nodes[0]!.layout.minWidth < baseMindmap.nodes[0]!.layout.minWidth * 1.8,
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

test('content-driven node boxes expand to a 1.5x content envelope to remove dead space', () => {
  const crowdedMindmap = generateMindmapFromAst({
    root: {
      id: 'root-research',
      kind: 'root',
      label: 'Research and Innovation Program',
      source: {
        line: 1,
        column: 1,
        indentLevel: 0,
        raw: '@root: Research and Innovation Program',
      },
      branches: [{
        id: 'branch-research',
        kind: 'branch',
        label: 'Comparative analysis of research methods, policy design, longitudinal evidence, and adoption outcomes across agencies',
        source: {
          line: 2,
          column: 1,
          indentLevel: 0,
          raw: '- @branch: Comparative analysis of research methods, policy design, longitudinal evidence, and adoption outcomes across agencies',
        },
        children: [{
          id: 'leaf-research',
          kind: 'leaf',
          label: 'Longitudinal evidence synthesis for adoption and policy design across institutional settings and stakeholder needs',
          source: {
            line: 3,
            column: 3,
            indentLevel: 1,
            raw: '  - Longitudinal evidence synthesis for adoption and policy design across institutional settings and stakeholder needs',
          },
          children: [],
        }],
      }],
    },
  });

  const branchNode = crowdedMindmap.nodes.find((node) => node.kind === 'branch');
  const leafNode = crowdedMindmap.nodes.find((node) => node.kind === 'leaf');

  assert.ok(branchNode, 'expected a branch node');
  assert.ok(leafNode, 'expected a leaf node');
  assert.equal(branchNode.layout.minWidth >= 220 * 1.5, true);
  assert.equal(leafNode.layout.minWidth >= 156 * 1.5, true);
  assert.equal(branchNode.layout.minHeight >= 84 * 1.5, true);
  assert.equal(leafNode.layout.minHeight >= 60 * 1.5, true);
});

test('createMindmapRadialLayoutOptions expands radius for crowded exported levels', () => {
  const crowdedMindmap = generateMindmapFromAst({
    root: {
      id: 'root-law',
      kind: 'root',
      label: 'Introduction to Law of Torts',
      source: {
        line: 1,
        column: 1,
        indentLevel: 0,
        raw: '@root: Introduction to Law of Torts',
      },
      branches: Array.from({ length: 12 }, (_, branchIndex) => ({
        id: `branch-${branchIndex + 1}`,
        kind: 'branch',
        label: `Branch ${branchIndex + 1} covering constitutional interpretation, institutional design, and remedial structure`,
        source: {
          line: branchIndex + 2,
          column: 1,
          indentLevel: 0,
          raw: `- @branch: Branch ${branchIndex + 1}`,
        },
        children: Array.from({ length: 6 }, (_, childIndex) => ({
          id: `leaf-${branchIndex + 1}-${childIndex + 1}`,
          kind: 'leaf',
          label: `Leaf ${childIndex + 1} with a long explanatory sentence about balancing tests, policy choices, and fact-sensitive standards`,
          source: {
            line: 100 + branchIndex * 10 + childIndex,
            column: 3,
            indentLevel: 1,
            raw: `  - Leaf ${childIndex + 1}`,
          },
          children: [],
        })),
      })),
    },
  });
  const exportMindmap = createExportMindmapVariant(crowdedMindmap, {
    nodeWidthScale: 1.45,
    nodeHeightScale: 1.6,
    nodePaddingScale: 1.25,
    siblingGapScale: 1,
    levelGapScale: 1,
    textScale: 1.7,
  });
  const options = createMindmapRadialLayoutOptions(exportMindmap);

  assert.equal(Number(options['org.eclipse.elk.radial.radius']) > exportMindmap.metadata.layout.levelGap, true);
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