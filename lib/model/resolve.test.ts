import assert from 'node:assert/strict';
import { test } from 'node:test';

import { anthropicMessagesAdapter } from './anthropic-messages-adapter.ts';
import { openaiCompatibleAdapter } from './openai-compatible-adapter.ts';
import { defaultModelAdapterRegistry, resolveModel } from './resolve.ts';

const openaiKey = { OPENAI_API_KEY: 'sk-real-openai-key' };
const anthropicKey = { ANTHROPIC_API_KEY: 'sk-real-anthropic-key' };

test('resolveModel returns the catalog entry, openai-compatible adapter, and credentials', () => {
  const resolved = resolveModel('gpt-5.4', { env: openaiKey });

  assert.equal(resolved.entry.id, 'gpt-5.4');
  assert.equal(resolved.entry.provider, 'openai');
  assert.equal(resolved.adapter, openaiCompatibleAdapter);
  assert.deepEqual(resolved.credentials, { apiKey: 'sk-real-openai-key' });
});

test('resolveModel selects the anthropic-messages adapter for Claude models', () => {
  const resolved = resolveModel('claude-sonnet-4-5', { env: anthropicKey });

  assert.equal(resolved.entry.provider, 'anthropic');
  assert.equal(resolved.adapter, anthropicMessagesAdapter);
  assert.deepEqual(resolved.credentials, { apiKey: 'sk-real-anthropic-key' });
});

test('resolveModel throws for an unknown model id', () => {
  assert.throws(() => resolveModel('made-up-model', { env: openaiKey }), /Unknown model id/);
});

test('resolveModel throws when the provider key is not configured', () => {
  assert.throws(
    () => resolveModel('claude-sonnet-4-5', { env: openaiKey }),
    /Set ANTHROPIC_API_KEY to use anthropic models/,
  );
});

test('resolveModel throws when no adapter is registered for the wire format', () => {
  assert.throws(
    () => resolveModel('gpt-5.4', { env: openaiKey, registry: {} }),
    /No model adapter registered for wire format: openai-compatible/,
  );
});

test('defaultModelAdapterRegistry maps every catalog wire format', () => {
  assert.equal(defaultModelAdapterRegistry['openai-compatible'], openaiCompatibleAdapter);
  assert.equal(defaultModelAdapterRegistry['anthropic-messages'], anthropicMessagesAdapter);
});
