import { z } from 'zod';

import {
  mindmapValidationErrorSchema,
  mindmapValidationWarningSchema,
} from '../dsl/validation.ts';
import { knownModelIdSchema } from '../model/catalog.ts';
import { parseStructuredModelJson } from '../model/json-parse.ts';

const requiredString = z.string().trim().min(1);

// Hard upper bound on source length. A single-call distillation prompt still has
// to fit the whole source in the model context, so beyond this we fail fast with
// a clear error instead of risking a context-overflow failure mid-generation.
export const maxSourceTextCharacters = 100_000;

export const sourceMindmapGenerationRequestSchema = z.object({
  sourceText: requiredString.max(
    maxSourceTextCharacters,
    'Source text is too long to process. Please shorten it and try again.',
  ),
  detailLevel: z.enum(['standard', 'detailed']).optional(),
  modelId: knownModelIdSchema.optional(),
}).strict();

export const sourceMindmapModelResponseSchema = z.object({
  dsl: requiredString,
}).strict();

export const sourceMindmapGenerationMetricsSchema = z.object({
  sourceMeaningfulLineCount: z.number().int().nonnegative(),
  generatedMeaningfulLineCount: z.number().int().positive(),
  expansionRatio: z.number().nonnegative(),
  targetMinLineCount: z.number().int().nonnegative(),
  targetMaxLineCount: z.number().int().nonnegative(),
  maxWordsPerLine: z.number().int().positive(),
  // Which pipeline path produced this result: expand small inputs, distill large
  // ones. Optional so previously persisted drafts (which predate it) still parse.
  generationMode: z.enum(['expand', 'distill']).optional(),
}).strict();

export const sourceMindmapGenerationValidationSchema = z.object({
  parserWarnings: z.array(mindmapValidationWarningSchema),
  parserErrors: z.array(mindmapValidationErrorSchema),
  lineWordLimitSatisfied: z.boolean(),
  expansionTargetSatisfied: z.boolean(),
}).strict();

export const sourceMindmapGenerationQualitySchema = z.object({
  attemptCount: z.number().int().positive(),
  mode: z.enum(['first-pass', 'retry']),
  densityStatus: z.enum(['below-target', 'target-met', 'over-target']),
  underdevelopedBranchCount: z.number().int().nonnegative(),
}).strict();

export const sourceMindmapGenerationResponseSchema = z.object({
  dsl: requiredString,
  metrics: sourceMindmapGenerationMetricsSchema,
  validation: sourceMindmapGenerationValidationSchema,
  quality: sourceMindmapGenerationQualitySchema,
}).strict();

export type SourceMindmapGenerationRequest = z.infer<typeof sourceMindmapGenerationRequestSchema>;
export type SourceMindmapModelResponse = z.infer<typeof sourceMindmapModelResponseSchema>;
export type SourceMindmapGenerationResponse = z.infer<typeof sourceMindmapGenerationResponseSchema>;

export const sourceMindmapModelResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['dsl'],
  properties: {
    dsl: {
      type: 'string',
      description: 'Mindmap DSL using exactly one @root block and nested - @branch / leaf lines.',
    },
  },
} as const;

export function parseSourceMindmapModelResponse(value: string): SourceMindmapModelResponse {
  return sourceMindmapModelResponseSchema.parse(parseStructuredModelJson(value));
}