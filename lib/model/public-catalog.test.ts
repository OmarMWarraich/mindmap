import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MODEL_CATALOG } from './catalog.ts';
import { listPublicModels, toPublicModel } from './public-catalog.ts';

const bothKeys: Record<string, string | undefined> = {
  OPENAI_API_KEY: 'openai-key',
  ANTHROPIC_API_KEY: 'anthropic-key',
};

test('toPublicModel exposes only non-secret fields', () => {
  const entry = MODEL_CATALOG[0];
  const publicModel = toPublicModel(entry);

  assert.deepEqual(Object.keys(publicModel).sort(), [
    'capabilities',
    'defaults',
    'id',
    'label',
    'provider',
    'roles',
  ]);
  // No secret or internal-routing fields leak through.
  assert.equal('wireFormat' in publicModel, false);
  assert.equal('apiKey' in publicModel, false);
  assert.equal('baseUrl' in publicModel, false);
});

test('toPublicModel returns a defensive copy of roles', () => {
  const entry = MODEL_CATALOG[0];
  const publicModel = toPublicModel(entry);

  assert.notEqual(publicModel.roles, entry.roles);
  assert.deepEqual(publicModel.roles, [...entry.roles]);
});

test('listPublicModels returns every model when all providers are configured', () => {
  const models = listPublicModels({ env: bothKeys });

  assert.equal(models.length, MODEL_CATALOG.length);
  assert.deepEqual(
    models.map((model) => model.id).sort(),
    MODEL_CATALOG.map((entry) => entry.id).sort(),
  );
});

test('listPublicModels hides models whose provider key is missing', () => {
  const models = listPublicModels({ env: { OPENAI_API_KEY: 'openai-key' } });

  assert.ok(models.length > 0);
  assert.ok(models.every((model) => model.provider === 'openai'));
});

test('listPublicModels returns nothing when no provider is configured', () => {
  assert.deepEqual(listPublicModels({ env: {} }), []);
});

test('listPublicModels narrows to a single role', () => {
  const models = listPublicModels({ role: 'generation', env: bothKeys });

  assert.ok(models.length > 0);
  assert.ok(models.every((model) => model.roles.includes('generation')));
});

test('listPublicModels honors the MODEL_ALLOWLIST env var', () => {
  const models = listPublicModels({
    env: { ...bothKeys, MODEL_ALLOWLIST: 'gpt-4o-mini' },
  });

  assert.deepEqual(models.map((model) => model.id), ['gpt-4o-mini']);
});
