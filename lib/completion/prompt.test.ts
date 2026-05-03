import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInlineCompletionPrompt,
  inlineCompletionPreferenceRules,
  inlineCompletionSystemPrompt,
  inlineCompletionUserPromptTemplate,
} from './prompt.ts';

test('inline completion prompt keeps the strict system instructions intact', () => {
  assert.match(inlineCompletionSystemPrompt, /You ONLY output the exact text to insert at the cursor\./);
  assert.match(inlineCompletionSystemPrompt, /If no strong completion is appropriate, output an empty string\./);
});

test('inline completion prompt injects local context into the reference user template', () => {
  const prompt = createInlineCompletionPrompt({
    lastTokens: '@root: Photosynthesis\n- @branch: Light reactions',
    currentBranchAndSubbranch: 'Branch: Light reactions\nSub-branch: ATP and NADPH',
    currentLineWithCursor: '  - ATP synth<CURSOR>',
  });

  assert.equal(prompt.system, inlineCompletionSystemPrompt);
  assert.ok(prompt.user.includes('CONTEXT WINDOW:\n@root: Photosynthesis\n- @branch: Light reactions'));
  assert.ok(prompt.user.includes('CURRENT STRUCTURAL CONTEXT:\nBranch: Light reactions\nSub-branch: ATP and NADPH'));
  assert.ok(prompt.user.includes('CURRENT LINE WITH CURSOR MARKER:\n  - ATP synth<CURSOR>'));
  assert.equal(prompt.user.includes('{{LAST_N_TOKENS}}'), false);
  assert.equal(prompt.user.includes('{{CURRENT_BRANCH_AND_SUBBRANCH}}'), false);
  assert.equal(prompt.user.includes('{{CURRENT_LINE_WITH_CURSOR}}'), false);
});

test('inline completion user template preserves the study-enrichment decision rules', () => {
  assert.match(inlineCompletionUserPromptTemplate, /Priority order:/);
  assert.match(inlineCompletionUserPromptTemplate, /a missing definition/);
  assert.match(inlineCompletionUserPromptTemplate, /Do not duplicate nearby sibling nodes or recently written ideas\./);
  assert.match(inlineCompletionUserPromptTemplate, /If that answer is clear and insertable, output it\./);
});

test('inline completion preference rules prioritize adjacent study enrichment', () => {
  assert.match(inlineCompletionPreferenceRules, /Prefer the nearest adjacent concept/);
  assert.match(inlineCompletionPreferenceRules, /Prefer missing subtopics over rewording text the user already wrote\./);
  assert.match(inlineCompletionPreferenceRules, /definitions, inputs and outputs, process steps, causes and effects, functions, and concrete examples/);
});

test('inline completion prompt appends the preference rules after the base template', () => {
  const prompt = createInlineCompletionPrompt({
    lastTokens: 'ATP synthase uses proton gradient',
    currentBranchAndSubbranch: 'Branch: Light reactions\nSub-branch: Chemiosmosis',
    currentLineWithCursor: '  - proton gradi<CURSOR>',
  });

  assert.ok(prompt.user.includes(inlineCompletionPreferenceRules));
});