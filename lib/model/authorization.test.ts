import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  authorizeModelId,
  getModelAllowList,
  isModelAllowListed,
} from './authorization.ts';

const openaiOnly = { OPENAI_API_KEY: 'sk-real-openai-key' };
const bothProviders = {
  OPENAI_API_KEY: 'sk-real-openai-key',
  ANTHROPIC_API_KEY: 'sk-real-anthropic-key',
};

test('authorizeModelId accepts a known, allow-listed, configured model', () => {
  const result = authorizeModelId('gpt-4o-mini', { role: 'completion', env: openaiOnly });
  assert.deepEqual(result, { ok: true, modelId: 'gpt-4o-mini' });
});

test('authorizeModelId rejects an unknown model id with 400', () => {
  const result = authorizeModelId('made-up-model', { env: bothProviders });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 400);
});

test('authorizeModelId rejects a model whose provider is not configured with 403', () => {
  const result = authorizeModelId('claude-sonnet-4-5', { role: 'generation', env: openaiOnly });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 403);
  assert.match(result.ok === false ? result.reason : '', /not configured/i);
});

test('authorizeModelId rejects a model that does not support the requested role', () => {
  const result = authorizeModelId('gpt-4o-mini', {
    role: 'embedding' as never,
    env: openaiOnly,
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 403);
  assert.match(result.ok === false ? result.reason : '', /role/i);
});

test('authorizeModelId enforces the MODEL_ALLOWLIST env var', () => {
  const env = { ...bothProviders, MODEL_ALLOWLIST: 'gpt-4o-mini, gpt-4o' };
  assert.equal(authorizeModelId('gpt-4o-mini', { env }).ok, true);

  const blocked = authorizeModelId('claude-sonnet-4-5', { env });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok === false && blocked.status, 403);
  assert.match(blocked.ok === false ? blocked.reason : '', /not permitted/i);
});

test('getModelAllowList returns null when MODEL_ALLOWLIST is unset or blank', () => {
  assert.equal(getModelAllowList({}), null);
  assert.equal(getModelAllowList({ MODEL_ALLOWLIST: '   ' }), null);
});

test('isModelAllowListed falls back to catalog membership without an allow-list', () => {
  assert.equal(isModelAllowListed('gpt-4o-mini', {}), true);
  assert.equal(isModelAllowListed('made-up-model', {}), false);
  assert.equal(isModelAllowListed('gpt-4o', { MODEL_ALLOWLIST: 'gpt-4o-mini' }), false);
});
