import { z } from 'zod';

import { getModelProviderEnv, type ModelProviderEnv } from '../config/env.ts';
import { extractInlineCompletionContextWindow } from './context.ts';
import { createInlineCompletionPrompt } from './prompt.ts';
import { requestModelProviderChatCompletion } from './provider.ts';

export const inlineCompletionRequestSchema = z.object({
  outline: z.string(),
  cursor: z.object({
    lineNumber: z.number().int().positive(),
    column: z.number().int().positive(),
  }),
  recentTokenBudget: z.number().int().positive().max(400).optional(),
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
    env?: ModelProviderEnv;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<InlineCompletionResponse> {
  const env = options.env ?? getModelProviderEnv();
  const context = extractInlineCompletionContextWindow(request.outline, request.cursor, {
    recentTokenBudget: request.recentTokenBudget,
  });
  const prompt = createInlineCompletionPrompt({
    lastTokens: context.recentText,
    currentBranchAndSubbranch: context.currentBranchAndSubbranch,
    currentLineWithCursor: context.currentLineWithCursor,
  });

  const completionText = await requestModelProviderChatCompletion({
    env,
    fetchImpl: options.fetchImpl,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
  });

  return inlineCompletionResponseSchema.parse({
    completionText,
    source: 'model',
  });
}