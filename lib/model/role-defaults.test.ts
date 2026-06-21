import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_MODEL_IDS,
  getDefaultModelIdForRole,
  isKnownModelId,
  selectModelIdForRole,
} from './catalog.ts';
import { resolveModelForRole } from './resolve.ts';

const openaiKey = { OPENAI_API_KEY: 'sk-real-openai-key' };

test('DEFAULT_MODEL_IDS provides a valid catalog id for every role', () => {
  for (const modelId of Object.values(DEFAULT_MODEL_IDS)) {
    assert.equal(isKnownModelId(modelId), true);
  }
});

test('getDefaultModelIdForRole returns the per-role default', () => {
  assert.equal(getDefaultModelIdForRole('completion'), 'gpt-4o-mini');
  assert.equal(getDefaultModelIdForRole('generation'), 'gpt-4o');
});

test('selectModelIdForRole falls back to the role default when no id is requested', () => {
  assert.equal(selectModelIdForRole('completion', undefined), 'gpt-4o-mini');
  assert.equal(selectModelIdForRole('generation', undefined), 'gpt-4o');
});

test('selectModelIdForRole honors an explicitly requested id', () => {
  assert.equal(selectModelIdForRole('completion', 'gpt-4o'), 'gpt-4o');
  assert.equal(selectModelIdForRole('generation', 'claude-sonnet-4-5'), 'claude-sonnet-4-5');
});

test('resolveModelForRole resolves the role default when modelId is absent', () => {
  const resolved = resolveModelForRole('completion', undefined, { env: openaiKey });
  assert.equal(resolved.entry.id, 'gpt-4o-mini');
});

test('resolveModelForRole resolves the requested model when present', () => {
  const resolved = resolveModelForRole('generation', 'gpt-4o-mini', { env: openaiKey });
  assert.equal(resolved.entry.id, 'gpt-4o-mini');
});
