import { z } from 'zod';

import { mindmapThemeSchema, type MindmapTheme } from '../mindmap/theme.ts';
import { knownModelIdSchema } from '../model/catalog.ts';
import { requestStructuredModelCompletion } from '../model/dispatch.ts';
import { parseStructuredModelJson } from '../model/json-parse.ts';
import { createMindmapThemePrompt } from './theme-prompt.ts';

const requiredString = z.string().trim().min(1);

export const mindmapThemeGenerationRequestSchema = z.object({
  stylePrompt: requiredString.max(500, 'Style prompt is too long. Keep it under 500 characters.'),
  mindmapTitle: z.string().trim().max(200).optional(),
  branchLabels: z.array(requiredString.max(120)).max(24).optional(),
  modelId: knownModelIdSchema.optional(),
}).strict();

export type MindmapThemeGenerationRequest = z.infer<typeof mindmapThemeGenerationRequestSchema>;

export const mindmapThemeGenerationResponseSchema = z.object({
  theme: mindmapThemeSchema,
  quality: z.object({
    attemptCount: z.number().int().positive(),
    mode: z.enum(['first-pass', 'retry']),
  }).strict(),
}).strict();

export type MindmapThemeGenerationResponse = z.infer<typeof mindmapThemeGenerationResponseSchema>;

const maxThemeCompletionTokens = 2_000;

export async function generateMindmapThemeFromPrompt(
  request: MindmapThemeGenerationRequest,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<MindmapThemeGenerationResponse> {
  const validatedRequest = mindmapThemeGenerationRequestSchema.parse(request);
  const prompt = createMindmapThemePrompt({
    stylePrompt: validatedRequest.stylePrompt,
    mindmapTitle: validatedRequest.mindmapTitle,
    branchLabels: validatedRequest.branchLabels,
  });

  const firstAttempt = await requestThemeCompletion(prompt.system, prompt.user, validatedRequest, options);
  const firstTheme = parseThemeAttempt(firstAttempt);

  if (firstTheme.ok) {
    return mindmapThemeGenerationResponseSchema.parse({
      theme: firstTheme.value,
      quality: { attemptCount: 1, mode: 'first-pass' },
    });
  }

  const retryPrompt = createMindmapThemePrompt({
    stylePrompt: validatedRequest.stylePrompt,
    mindmapTitle: validatedRequest.mindmapTitle,
    branchLabels: validatedRequest.branchLabels,
    previousAttempt: firstAttempt,
    previousAttemptIssues: firstTheme.error,
  });
  const retryAttempt = await requestThemeCompletion(retryPrompt.system, retryPrompt.user, validatedRequest, options);
  const retryTheme = parseThemeAttempt(retryAttempt);

  if (!retryTheme.ok) {
    throw new Error('The model did not return a valid theme. Try rephrasing the style request.');
  }

  return mindmapThemeGenerationResponseSchema.parse({
    theme: retryTheme.value,
    quality: { attemptCount: 2, mode: 'retry' },
  });
}

async function requestThemeCompletion(
  system: string,
  user: string,
  request: MindmapThemeGenerationRequest,
  options: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch },
): Promise<string> {
  const completion = await requestStructuredModelCompletion({
    role: 'generation',
    modelId: request.modelId,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    maxTokens: maxThemeCompletionTokens,
    env: options.env,
    fetchImpl: options.fetchImpl,
  });

  return completion.text;
}

export function parseThemeAttempt(
  text: string,
): { ok: true; value: MindmapTheme } | { ok: false; error: string } {
  let parsedJson: unknown;

  try {
    parsedJson = parseStructuredModelJson(text);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The response was not valid JSON.',
    };
  }

  const result = mindmapThemeSchema.safeParse(parsedJson);

  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .map((issue) => `${issue.path.join('.') || 'theme'}: ${issue.message}`)
        .join('; '),
    };
  }

  // The model cannot produce real image data; a hallucinated data URI is unusable.
  if (result.data.background.kind === 'image') {
    return {
      ok: false,
      error: 'background.kind: "image" is not allowed; use "solid", "gradient", or "grid".',
    };
  }

  return { ok: true, value: result.data };
}
