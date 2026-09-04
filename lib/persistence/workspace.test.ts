import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from '../mindmap/__fixtures__/generatedMindmap.ts';
import { parsePersistedWorkspaceDraft } from './workspace.ts';

test('parsePersistedWorkspaceDraft returns a validated draft payload', () => {
  const draft = parsePersistedWorkspaceDraft({
    version: 1,
    updatedAt: '2026-05-03T00:00:00.000Z',
    outline: '@root: Photosynthesis',
    rawNotes: 'Main Topic: Photosynthesis',
    selectedDetailLevel: 'detailed',
    latestDslGeneration: {
      dsl: '@root: Photosynthesis',
      metrics: {
        sourceMeaningfulLineCount: 1,
        generatedMeaningfulLineCount: 3,
        expansionRatio: 3,
        targetMinLineCount: 3,
        targetMaxLineCount: 3,
        maxWordsPerLine: 15,
      },
      validation: {
        parserWarnings: [],
        parserErrors: [],
        lineWordLimitSatisfied: true,
        expansionTargetSatisfied: true,
      },
      quality: {
        attemptCount: 1,
        mode: 'first-pass',
        densityStatus: 'target-met',
        underdevelopedBranchCount: 0,
      },
    },
    mindmap: validGeneratedMindmapFixture,
    previewTransform: {
      scale: 1.2,
      translateX: 10,
      translateY: -14,
    },
  });

  assert.equal(draft?.outline, '@root: Photosynthesis');
  assert.equal(draft?.rawNotes, 'Main Topic: Photosynthesis');
  assert.equal(draft?.selectedDetailLevel, 'detailed');
  assert.equal(draft?.latestDslGeneration?.quality.mode, 'first-pass');
  assert.equal(draft?.previewTransform.scale, 1.2);
  assert.equal(draft?.mindmap?.metadata.rootId, validGeneratedMindmapFixture.metadata.rootId);
});

test('parsePersistedWorkspaceDraft accepts older draft payloads without generation metadata', () => {
  const draft = parsePersistedWorkspaceDraft({
    version: 1,
    updatedAt: '2026-05-03T00:00:00.000Z',
    outline: '@root: Photosynthesis',
    mindmap: null,
    previewTransform: {
      scale: 1,
      translateX: 0,
      translateY: 0,
    },
  });

  assert.equal(draft?.rawNotes, undefined);
  assert.equal(draft?.selectedDetailLevel, undefined);
  assert.equal(draft?.latestDslGeneration, undefined);
});

test('parsePersistedWorkspaceDraft rejects malformed preview transforms', () => {
  const draft = parsePersistedWorkspaceDraft({
    version: 1,
    updatedAt: '2026-05-03T00:00:00.000Z',
    outline: '@root: Photosynthesis',
    mindmap: null,
    previewTransform: {
      scale: 0,
      translateX: 0,
      translateY: 0,
    },
  });

  assert.equal(draft, null);
});

test('parsePersistedWorkspaceDraft round-trips node position overrides', () => {
  const draft = parsePersistedWorkspaceDraft({
    version: 1,
    updatedAt: '2026-05-03T00:00:00.000Z',
    outline: '@root: Photosynthesis',
    mindmap: null,
    previewTransform: {
      scale: 1,
      translateX: 0,
      translateY: 0,
    },
    nodePositionOverrides: { 'branch-1-overview': { dx: 24, dy: -12 } },
  });

  assert.deepEqual(draft?.nodePositionOverrides, {
    'branch-1-overview': { dx: 24, dy: -12 },
  });
});

test('parsePersistedWorkspaceDraft rejects malformed node position overrides', () => {
  const draft = parsePersistedWorkspaceDraft({
    version: 1,
    updatedAt: '2026-05-03T00:00:00.000Z',
    outline: '@root: Photosynthesis',
    mindmap: null,
    previewTransform: {
      scale: 1,
      translateX: 0,
      translateY: 0,
    },
    nodePositionOverrides: { 'branch-1-overview': { dx: 'sideways', dy: 0 } },
  });

  assert.equal(draft, null);
});