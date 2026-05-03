import { z } from 'zod';

const requiredString = z.string().trim().min(1);

export const mindmapGenerationLabelRewriteSchema = z.object({
  nodeId: requiredString,
  label: requiredString,
  reason: requiredString,
}).strict();

export const mindmapGenerationGroupingSuggestionSchema = z.object({
  parentNodeId: requiredString,
  groupLabel: requiredString,
  childNodeIds: z.array(requiredString).min(2),
  reason: requiredString,
}).strict().superRefine((suggestion, ctx) => {
  const uniqueChildNodeIds = new Set(suggestion.childNodeIds);

  if (uniqueChildNodeIds.size !== suggestion.childNodeIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['childNodeIds'],
      message: 'grouping suggestion childNodeIds must be unique',
    });
  }
});

export const mindmapGenerationMissingSubtopicSchema = z.object({
  parentNodeId: requiredString,
  label: requiredString,
  reason: requiredString,
}).strict();

export const mindmapGenerationResponseSchema = z.object({
  title: requiredString,
  labelRewrites: z.array(mindmapGenerationLabelRewriteSchema),
  groupingSuggestions: z.array(mindmapGenerationGroupingSuggestionSchema),
  suggestedMissingSubtopics: z.array(mindmapGenerationMissingSubtopicSchema),
}).strict().superRefine((response, ctx) => {
  const rewrittenNodeIds = new Set<string>();

  response.labelRewrites.forEach((rewrite, index) => {
    if (rewrittenNodeIds.has(rewrite.nodeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['labelRewrites', index, 'nodeId'],
        message: `Duplicate label rewrite for node "${rewrite.nodeId}"`,
      });
      return;
    }

    rewrittenNodeIds.add(rewrite.nodeId);
  });
});

export type MindmapGenerationLabelRewrite = z.infer<typeof mindmapGenerationLabelRewriteSchema>;
export type MindmapGenerationGroupingSuggestion = z.infer<typeof mindmapGenerationGroupingSuggestionSchema>;
export type MindmapGenerationMissingSubtopic = z.infer<typeof mindmapGenerationMissingSubtopicSchema>;
export type MindmapGenerationResponse = z.infer<typeof mindmapGenerationResponseSchema>;

export const mindmapGenerationResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'labelRewrites', 'groupingSuggestions', 'suggestedMissingSubtopics'],
  properties: {
    title: {
      type: 'string',
      description: 'Study-friendly title for the generated mindmap.',
    },
    labelRewrites: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nodeId', 'label', 'reason'],
        properties: {
          nodeId: { type: 'string' },
          label: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    groupingSuggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['parentNodeId', 'groupLabel', 'childNodeIds', 'reason'],
        properties: {
          parentNodeId: { type: 'string' },
          groupLabel: { type: 'string' },
          childNodeIds: {
            type: 'array',
            items: { type: 'string' },
          },
          reason: { type: 'string' },
        },
      },
    },
    suggestedMissingSubtopics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['parentNodeId', 'label', 'reason'],
        properties: {
          parentNodeId: { type: 'string' },
          label: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

export function validateMindmapGenerationResponse(input: unknown): MindmapGenerationResponse {
  return mindmapGenerationResponseSchema.parse(input);
}