import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultMindmapTheme } from '../mindmap/theme.ts';
import { generateMindmapThemeFromPrompt, parseThemeAttempt } from './theme-service.ts';

// The generation-role default resolves against ANTHROPIC_API_KEY with the
// anthropic-messages response shape, matching the source-service test setup.
const testEnv: Record<string, string | undefined> = {
  ANTHROPIC_API_KEY: 'test-key',
};

const validThemePayload = {
  ...defaultMindmapTheme,
  name: 'Forest Depths',
  background: { kind: 'gradient', from: '#14532d', to: '#052e16', angle: 135 },
};

function anthropicResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('generateMindmapThemeFromPrompt returns a validated theme on the first pass', async () => {
  const response = await generateMindmapThemeFromPrompt(
    { stylePrompt: 'earthy forest tones' },
    {
      env: testEnv,
      fetchImpl: async () => anthropicResponse(JSON.stringify(validThemePayload)),
    },
  );

  assert.equal(response.theme.name, 'Forest Depths');
  assert.equal(response.theme.background.kind, 'gradient');
  assert.equal(response.quality.attemptCount, 1);
  assert.equal(response.quality.mode, 'first-pass');
});

test('generateMindmapThemeFromPrompt retries once when the first response is invalid', async () => {
  let callCount = 0;
  const response = await generateMindmapThemeFromPrompt(
    { stylePrompt: 'ocean blues' },
    {
      env: testEnv,
      fetchImpl: async () => {
        callCount += 1;
        return anthropicResponse(
          callCount === 1 ? '{"version": 2}' : JSON.stringify(validThemePayload),
        );
      },
    },
  );

  assert.equal(callCount, 2);
  assert.equal(response.quality.attemptCount, 2);
  assert.equal(response.quality.mode, 'retry');
});

test('generateMindmapThemeFromPrompt throws when both attempts are invalid', async () => {
  await assert.rejects(
    async () =>
      generateMindmapThemeFromPrompt(
        { stylePrompt: 'neon cyberpunk' },
        {
          env: testEnv,
          fetchImpl: async () => anthropicResponse('not json at all'),
        },
      ),
    /did not return a valid theme/,
  );
});

test('parseThemeAttempt rejects image backgrounds from the model', () => {
  const result = parseThemeAttempt(
    JSON.stringify({
      ...defaultMindmapTheme,
      background: {
        kind: 'image',
        imageDataUrl: 'data:image/png;base64,abc',
        overlayColor: '#000000',
        overlayOpacity: 0.4,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /"image" is not allowed/);
});

test('parseThemeAttempt reports schema violations with field paths', () => {
  const result = parseThemeAttempt(
    JSON.stringify({ ...defaultMindmapTheme, typography: { ...defaultMindmapTheme.typography, rootFontScale: 9 } }),
  );

  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /typography\.rootFontScale/);
});

test('generateMindmapThemeFromPrompt rejects an overlong style prompt', async () => {
  await assert.rejects(
    async () =>
      generateMindmapThemeFromPrompt(
        { stylePrompt: 'x'.repeat(501) },
        { env: testEnv, fetchImpl: async () => anthropicResponse('{}') },
      ),
  );
});
