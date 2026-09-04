import assert from 'node:assert/strict';
import test from 'node:test';

import { createMindmapThemePrompt, mindmapThemeGenerationSystemPrompt } from './theme-prompt.ts';

test('createMindmapThemePrompt includes the style request and output contract', () => {
  const prompt = createMindmapThemePrompt({ stylePrompt: 'earthy forest tones' });

  assert.equal(prompt.system, mindmapThemeGenerationSystemPrompt);
  assert.match(prompt.user, /STYLE REQUEST: earthy forest tones/);
  assert.match(prompt.user, /"version": 1/);
  assert.match(prompt.user, /"colorMode": "branch" \| "mono"/);
});

test('createMindmapThemePrompt forbids image backgrounds in the system prompt', () => {
  const prompt = createMindmapThemePrompt({ stylePrompt: 'ocean blues' });

  assert.match(prompt.system, /Never use background kind "image"/);
});

test('createMindmapThemePrompt includes mindmap context when provided', () => {
  const prompt = createMindmapThemePrompt({
    stylePrompt: 'dark academia',
    mindmapTitle: 'Pakistan Environmental Law',
    branchLabels: ['Scope', 'Institutions'],
  });

  assert.match(prompt.user, /MINDMAP TITLE: Pakistan Environmental Law/);
  assert.match(prompt.user, /MAIN BRANCHES: Scope \| Institutions/);
});

test('createMindmapThemePrompt embeds retry feedback and the previous attempt', () => {
  const prompt = createMindmapThemePrompt({
    stylePrompt: 'neon cyberpunk',
    previousAttempt: '{"version":2}',
    previousAttemptIssues: 'version: Invalid literal value, expected 1',
  });

  assert.match(prompt.user, /previous response was rejected/);
  assert.match(prompt.user, /version: Invalid literal value, expected 1/);
  assert.match(prompt.user, /\{"version":2\}/);
});
