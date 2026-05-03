import assert from 'node:assert/strict';
import test from 'node:test';

import { mindmapAstFixture } from '../../../lib/mindmap/__fixtures__/generatedMindmap.ts';
import { POST } from './route.ts';

test('generation route returns a validated overlay for a valid request', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  process.env.MODEL_PROVIDER = 'openai';
  process.env.MODEL_API_KEY = 'test-key';
  process.env.MODEL_COMPLETION_MODEL = 'gpt-5-mini';
  process.env.MODEL_GENERATION_MODEL = 'gpt-5';
  delete process.env.MODEL_BASE_URL;

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      title: 'Photosynthesis',
      labelRewrites: [{
        nodeId: 'branch-1-overview',
        label: 'Core overview',
        reason: 'Clarifies the branch focus.',
      }],
      groupingSuggestions: [],
      suggestedMissingSubtopics: [{
        parentNodeId: 'branch-2-calvin-cycle',
        label: 'Energy cost',
        reason: 'Students usually need the ATP and NADPH requirement here.',
      }],
    }) } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(new Request('http://localhost/api/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawDsl: '@root: Photosynthesis\n- @branch: Overview\n  - Definition',
        ast: mindmapAstFixture,
        warnings: [],
        errors: [],
      }),
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.deepEqual(payload.overlay, {
      title: 'Photosynthesis',
      labelRewrites: [{
        nodeId: 'branch-1-overview',
        label: 'Core overview',
        reason: 'Clarifies the branch focus.',
      }],
      groupingSuggestions: [],
      suggestedMissingSubtopics: [{
        parentNodeId: 'branch-2-calvin-cycle',
        label: 'Energy cost',
        reason: 'Students usually need the ATP and NADPH requirement here.',
      }],
    });
    assert.deepEqual(payload.suggestedMissingSubtopics, [{
      parentNodeId: 'branch-2-calvin-cycle',
      label: 'Energy cost',
      reason: 'Students usually need the ATP and NADPH requirement here.',
    }]);
    assert.equal(payload.mindmap.metadata.title, 'Photosynthesis');
    assert.equal(
      payload.mindmap.nodes.find((node: { id: string; label: string }) => node.id === 'branch-1-overview')?.label,
      'Core overview',
    );
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test('generation route rejects invalid request payloads', async () => {
  const response = await POST(new Request('http://localhost/api/generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawDsl: 12 }),
  }));

  assert.equal(response.status, 400);
});