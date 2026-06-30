import assert from 'node:assert/strict';
import test from 'node:test';

import { validGeneratedMindmapFixture } from '../mindmap/__fixtures__/generatedMindmap.ts';
import { createProjectSchema, draftUpdateSchema, historyCreateSchema } from './projects-schema.ts';

test('draftUpdateSchema accepts a valid partial update and strips unknown keys', () => {
  const parsed = draftUpdateSchema.parse({
    outline: '@root: X',
    previewTransform: { scale: 1, translateX: 0, translateY: 0 },
    mindmap: validGeneratedMindmapFixture,
    unexpected: 'ignored',
  });

  assert.equal(parsed.outline, '@root: X');
  assert.equal('unexpected' in parsed, false);
  assert.ok(parsed.mindmap);
});

test('draftUpdateSchema allows mindmap and previewTransform to be null', () => {
  const parsed = draftUpdateSchema.parse({ mindmap: null, previewTransform: null });
  assert.equal(parsed.mindmap, null);
  assert.equal(parsed.previewTransform, null);
});

test('draftUpdateSchema rejects malformed fields instead of coercing them', () => {
  assert.throws(() => draftUpdateSchema.parse({ outline: 123 }));
  assert.throws(() => draftUpdateSchema.parse({ selectedDetailLevel: 'verbose' }));
  // scale must be positive — guards the persisted previewTransform jsonb.
  assert.throws(() =>
    draftUpdateSchema.parse({ previewTransform: { scale: 0, translateX: 0, translateY: 0 } }),
  );
  // guards the persisted mindmap jsonb against malformed shapes.
  assert.throws(() => draftUpdateSchema.parse({ mindmap: { not: 'a mindmap' } }));
});

test('historyCreateSchema applies the prior per-field defaults when omitted', () => {
  assert.deepEqual(historyCreateSchema.parse({}), {
    detailLevel: 'standard',
    dsl: '',
    densityStatus: 'target-met',
    nodeCount: 0,
    rawNotes: '',
  });
});

test('historyCreateSchema rejects a wrong-typed nodeCount', () => {
  assert.throws(() => historyCreateSchema.parse({ nodeCount: 'lots' }));
});

test('createProjectSchema treats name as optional', () => {
  assert.deepEqual(createProjectSchema.parse({}), {});
  assert.deepEqual(createProjectSchema.parse({ name: 'My Project' }), { name: 'My Project' });
});
