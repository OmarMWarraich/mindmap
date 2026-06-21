import { z } from 'zod';

import { extractInlineCompletionContextWindow } from './context.ts';
import { normalizeInlineCompletionOutput } from './normalize.ts';
import { createInlineCompletionPrompt } from './prompt.ts';
import { knownModelIdSchema } from '../model/catalog.ts';
import { requestStructuredModelCompletion } from '../model/dispatch.ts';
import { evaluateInlineCompletionRelevance } from './relevance.ts';
import { rejectDuplicateSiblingCompletion } from './sibling-check.ts';

// Ghost-text inline completions are intentionally short, so cap the budget here
// rather than inheriting a model's larger general-purpose default. This keeps the
// previous tuned ghost-text budget regardless of which model the request selects.
const inlineCompletionMaxTokens = 72;

export const inlineCompletionRequestSchema = z.object({
  outline: z.string(),
  cursor: z.object({
    lineNumber: z.number().int().positive(),
    column: z.number().int().positive(),
  }),
  recentTokenBudget: z.number().int().positive().max(400).optional(),
  modelId: knownModelIdSchema.optional(),
}).strict();

export const inlineCompletionResponseSchema = z.object({
  completionText: z.string(),
  source: z.literal('model'),
});

export type InlineCompletionRequest = z.infer<typeof inlineCompletionRequestSchema>;
export type InlineCompletionResponse = z.infer<typeof inlineCompletionResponseSchema>;

export async function generateInlineCompletion(
  request: InlineCompletionRequest,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<InlineCompletionResponse> {
  const context = extractInlineCompletionContextWindow(request.outline, request.cursor, {
    recentTokenBudget: request.recentTokenBudget,
  });
  const prompt = createInlineCompletionPrompt({
    lastTokens: context.recentText,
    currentBranchAndSubbranch: context.currentBranchAndSubbranch,
    currentLineWithCursor: context.currentLineWithCursor,
  });

  // Dispatch by role so the request honors the caller's `modelId` (the UI
  // selection) or the completion-role default, resolving the provider and its
  // server-side credentials from per-provider env. Inline completion is free
  // text, so no structured-output strategy is requested.
  const completion = await requestStructuredModelCompletion({
    role: 'completion',
    modelId: request.modelId,
    env: options.env,
    fetchImpl: options.fetchImpl,
    maxTokens: inlineCompletionMaxTokens,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
  });
  const normalizedCompletionText = normalizeInlineCompletionOutput(completion.text, {
    currentLinePrefix: context.linePrefix,
  });
  const relevance = evaluateInlineCompletionRelevance(normalizedCompletionText, context);
  const siblingDuplication = rejectDuplicateSiblingCompletion(
    normalizedCompletionText,
    request.outline,
    request.cursor,
  );

  return inlineCompletionResponseSchema.parse({
    completionText:
      relevance.accepted && siblingDuplication.accepted ? normalizedCompletionText : '',
    source: 'model',
  });
}