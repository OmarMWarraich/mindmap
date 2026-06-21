import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatProviderLabel, groupModelsByProvider } from './group-models.ts';
import type { PublicModel } from './public-catalog.ts';

function model(id: string, provider: PublicModel['provider'], label: string): PublicModel {
  return {
    id,
    provider,
    label,
    roles: ['generation'],
    capabilities: { structuredOutput: 'response_format', contextWindow: 128_000 },
    defaults: { temperature: 0.2, maxTokens: 1024 },
  };
}

test('formatProviderLabel maps known providers to display names', () => {
  assert.equal(formatProviderLabel('openai'), 'OpenAI');
  assert.equal(formatProviderLabel('anthropic'), 'Anthropic');
});

test('formatProviderLabel capitalizes unknown providers', () => {
  assert.equal(formatProviderLabel('deepseek'), 'Deepseek');
});

test('groupModelsByProvider groups models under their provider', () => {
  const groups = groupModelsByProvider([
    model('gpt-4o', 'openai', 'GPT-4o'),
    model('gpt-4o-mini', 'openai', 'GPT-4o mini'),
    model('claude-sonnet-4-5', 'anthropic', 'Claude Sonnet 4.5'),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], {
    provider: 'openai',
    label: 'OpenAI',
    models: [model('gpt-4o', 'openai', 'GPT-4o'), model('gpt-4o-mini', 'openai', 'GPT-4o mini')],
  });
  assert.deepEqual(groups[1].models.map((m) => m.id), ['claude-sonnet-4-5']);
});

test('groupModelsByProvider preserves first-seen provider and model order', () => {
  const groups = groupModelsByProvider([
    model('claude-sonnet-4-5', 'anthropic', 'Claude Sonnet 4.5'),
    model('gpt-4o', 'openai', 'GPT-4o'),
    model('claude-haiku-4-5', 'anthropic', 'Claude Haiku 4.5'),
  ]);

  assert.deepEqual(groups.map((group) => group.provider), ['anthropic', 'openai']);
  assert.deepEqual(groups[0].models.map((m) => m.id), ['claude-sonnet-4-5', 'claude-haiku-4-5']);
});

test('groupModelsByProvider returns an empty array for no models', () => {
  assert.deepEqual(groupModelsByProvider([]), []);
});
