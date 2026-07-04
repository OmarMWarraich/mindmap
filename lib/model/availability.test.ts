import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isModelAvailable,
  listAvailableModels,
  listAvailableModelsForRole,
  listConfiguredProviders,
} from './availability.ts';

const openaiOnly = { OPENAI_API_KEY: 'sk-real-openai-key' };
const bothProviders = {
  OPENAI_API_KEY: 'sk-real-openai-key',
  ANTHROPIC_API_KEY: 'sk-ant-real-key',
};

test('listConfiguredProviders returns only providers with a configured key', () => {
  assert.deepEqual(listConfiguredProviders(openaiOnly), ['openai']);
  assert.deepEqual(listConfiguredProviders(bothProviders), ['openai', 'anthropic']);
  assert.deepEqual(listConfiguredProviders({}), []);
});

test('listAvailableModels filters the catalog to configured providers', () => {
  const ids = listAvailableModels(openaiOnly).map((entry) => entry.id);
  assert.ok(ids.includes('gpt-5.4'));
  assert.ok(ids.includes('gpt-5.5'));
  assert.ok(ids.every((id) => id.startsWith('gpt-')));
});

test('listAvailableModels includes every provider when all keys are present', () => {
  const providers = new Set(listAvailableModels(bothProviders).map((entry) => entry.provider));
  assert.deepEqual([...providers].sort(), ['anthropic', 'openai']);
});

test('listAvailableModels is empty when no keys are configured', () => {
  assert.deepEqual(listAvailableModels({}), []);
});

test('isModelAvailable is true only when the model provider is configured', () => {
  assert.equal(isModelAvailable('gpt-5.4', openaiOnly), true);
  assert.equal(isModelAvailable('claude-sonnet-4-5', openaiOnly), false);
  assert.equal(isModelAvailable('claude-sonnet-4-5', bothProviders), true);
});

test('isModelAvailable is false for unknown model ids', () => {
  assert.equal(isModelAvailable('does-not-exist', bothProviders), false);
});

test('listAvailableModelsForRole respects both role and configured providers', () => {
  const completionIds = listAvailableModelsForRole('completion', openaiOnly).map((entry) => entry.id);
  assert.ok(completionIds.includes('gpt-5.4'));
  assert.ok(completionIds.every((id) => id.startsWith('gpt-')));
});
