import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from '../mindmap/__fixtures__/generatedMindmap.ts';
import { parsePersistedWorkspaceDraft } from './workspace.ts';

test('parsePersistedWorkspaceDraft returns a validated draft payload', () => {
  const draft = parsePersistedWorkspaceDraft({
    version: 1,
    updatedAt: '2026-05-03T00:00:00.000Z',
    outline: '@root: Photosynthesis',
    mindmap: validGeneratedMindmapFixture,
    previewTransform: {
      scale: 1.2,
      translateX: 10,
      translateY: -14,
    },
  });

  assert.equal(draft?.outline, '@root: Photosynthesis');
  assert.equal(draft?.previewTransform.scale, 1.2);
  assert.equal(draft?.mindmap?.metadata.rootId, validGeneratedMindmapFixture.metadata.rootId);
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