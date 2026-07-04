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
const anthropicKey = { ANTHROPIC_API_KEY: 'sk-real-anthropic-key' };

test('DEFAULT_MODEL_IDS provides a valid catalog id for every role', () => {
  for (const modelId of Object.values(DEFAULT_MODEL_IDS)) {
    assert.equal(isKnownModelId(modelId), true);
  }
});

test('getDefaultModelIdForRole returns the per-role default', () => {
  assert.equal(getDefaultModelIdForRole('completion'), 'claude-haiku-4-5');
  assert.equal(getDefaultModelIdForRole('generation'), 'claude-haiku-4-5');
});

test('selectModelIdForRole falls back to the role default when no id is requested', () => {
  assert.equal(selectModelIdForRole('completion', undefined), 'claude-haiku-4-5');
  assert.equal(selectModelIdForRole('generation', undefined), 'claude-haiku-4-5');
});

test('selectModelIdForRole honors an explicitly requested id', () => {
  assert.equal(selectModelIdForRole('completion', 'gpt-5.4'), 'gpt-5.4');
  assert.equal(selectModelIdForRole('generation', 'claude-sonnet-4-5'), 'claude-sonnet-4-5');
});

test('resolveModelForRole resolves the role default when modelId is absent', () => {
  const resolved = resolveModelForRole('completion', undefined, { env: anthropicKey });
  assert.equal(resolved.entry.id, 'claude-haiku-4-5');
});

test('resolveModelForRole resolves the requested model when present', () => {
  const resolved = resolveModelForRole('generation', 'gpt-5.4', { env: openaiKey });
  assert.equal(resolved.entry.id, 'gpt-5.4');
});
