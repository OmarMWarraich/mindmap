import { z } from 'zod';

import { generatedMindmapSchema } from '../mindmap/schema.ts';

// Shared Zod schemas for project API request bodies. Replaces the ad hoc
// `typeof body.x === 'string' ? x : default` coercion in the route handlers and
// gives the persisted `jsonb` columns (mindmap, previewTransform) the same
// schema-as-contract validation used elsewhere in the codebase.

export const previewTransformSchema = z
  .object({
    scale: z.number().positive(),
    translateX: z.number(),
    translateY: z.number(),
  })
  .strict();

// All fields optional: a draft PUT is a partial update. Missing fields fall back
// to the existing row (or column defaults on create); unknown top-level keys are
// stripped, preserving the prior "ignore extras" behavior. A present-but-malformed
// field now fails validation instead of being silently coerced to a default.
export const draftUpdateSchema = z.object({
  outline: z.string().optional(),
  rawNotes: z.string().optional(),
  selectedDetailLevel: z.enum(['standard', 'detailed', 'compact', 'plain']).optional(),
  mindmap: generatedMindmapSchema.nullable().optional(),
  previewTransform: previewTransformSchema.nullable().optional(),
});

export type DraftUpdateInput = z.infer<typeof draftUpdateSchema>;

// `.default()` reproduces the previous per-field fallbacks exactly when a field is
// omitted; detailLevel/densityStatus stay free-form strings to match the text
// columns (and the prior accept-any-string behavior).
export const historyCreateSchema = z.object({
  detailLevel: z.string().default('standard'),
  dsl: z.string().default(''),
  densityStatus: z.string().default('target-met'),
  nodeCount: z.number().default(0),
  rawNotes: z.string().default(''),
});

export type HistoryCreateInput = z.infer<typeof historyCreateSchema>;

export const createProjectSchema = z.object({
  name: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
