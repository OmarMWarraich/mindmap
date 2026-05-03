import { z } from 'zod';

import type { MindmapDocumentAst, MindmapRootAstNode, MindmapBranchAstNode, MindmapLeafAstNode } from '../dsl/ast.ts';
import {
  mindmapValidationErrorSchema,
  mindmapValidationWarningSchema,
} from '../dsl/validation.ts';
import { getModelProviderEnv, type ModelProviderEnv } from '../config/env.ts';
import { requestModelProviderChatCompletion } from '../completion/provider.ts';
import { generateMindmapFromAst } from '../mindmap/from-ast.ts';
import { generatedMindmapSchema } from '../mindmap/schema.ts';
import { mergeDeterministicMindmapWithOverlay } from './merge.ts';
import { createMindmapGenerationPrompt } from './prompt.ts';
import {
  mindmapGenerationResponseJsonSchema,
  mindmapGenerationResponseSchema,
  type MindmapGenerationResponse,
} from './schema.ts';

const astSourceSchema = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  indentLevel: z.number().int().nonnegative(),
  raw: z.string(),
}).strict();

const leafAstNodeSchema: z.ZodType<MindmapLeafAstNode> = z.lazy(() => z.object({
  id: z.string().min(1),
  kind: z.literal('leaf'),
  label: z.string(),
  source: astSourceSchema,
  children: z.array(leafAstNodeSchema),
}).strict());

const branchAstNodeSchema: z.ZodType<MindmapBranchAstNode> = z.object({
  id: z.string().min(1),
  kind: z.literal('branch'),
  label: z.string(),
  source: astSourceSchema,
  children: z.array(leafAstNodeSchema),
}).strict();

const rootAstNodeSchema: z.ZodType<MindmapRootAstNode> = z.object({
  id: z.string().min(1),
  kind: z.literal('root'),
  label: z.string(),
  source: astSourceSchema,
  branches: z.array(branchAstNodeSchema),
}).strict();

const mindmapDocumentAstSchema: z.ZodType<MindmapDocumentAst> = z.object({
  root: rootAstNodeSchema,
}).strict();

export const generationRequestSchema = z.object({
  rawDsl: z.string(),
  ast: mindmapDocumentAstSchema,
  warnings: z.array(mindmapValidationWarningSchema).optional(),
  errors: z.array(mindmapValidationErrorSchema).optional(),
}).strict();

export const generationOverlayResponseSchema = z.object({
  mindmap: generatedMindmapSchema,
  overlay: mindmapGenerationResponseSchema,
}).strict();

export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type GenerationOverlayResponse = z.infer<typeof generationOverlayResponseSchema>;

export async function generateMindmapOverlay(
  request: GenerationRequest,
  options: {
    env?: ModelProviderEnv;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<GenerationOverlayResponse> {
  const env = options.env ?? getModelProviderEnv();
  const deterministicMindmap = generateMindmapFromAst(request.ast, {
    warnings: request.warnings,
    errors: request.errors,
  });
  const prompt = createMindmapGenerationPrompt({
    astSummary: summarizeMindmapAst(request.ast),
    rawDsl: request.rawDsl,
    deterministicMindmap,
  });
  const completionText = await requestModelProviderChatCompletion({
    env,
    fetchImpl: options.fetchImpl,
    model: env.MODEL_GENERATION_MODEL,
    maxCompletionTokens: 800,
    temperature: 0.2,
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'mindmap_generation_overlay',
        strict: true,
        schema: mindmapGenerationResponseJsonSchema,
      },
    },
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
  });

  const overlay = parseMindmapGenerationOverlay(completionText);

  return generationOverlayResponseSchema.parse({
    mindmap: mergeDeterministicMindmapWithOverlay(deterministicMindmap, overlay),
    overlay,
  });
}

export function parseMindmapGenerationOverlay(value: string): MindmapGenerationResponse {
  return mindmapGenerationResponseSchema.parse(JSON.parse(value));
}

export function summarizeMindmapAst(ast: MindmapDocumentAst): string {
  const lines = [`Root: ${ast.root.label}`];

  ast.root.branches.forEach((branch) => {
    lines.push(`Branch: ${branch.label}`);
    appendLeafSummary(lines, branch.children, 1);
  });

  return lines.join('\n');
}

function appendLeafSummary(lines: string[], leaves: MindmapLeafAstNode[], depth: number): void {
  leaves.forEach((leaf) => {
    lines.push(`${'  '.repeat(depth)}- ${leaf.label}`);
    appendLeafSummary(lines, leaf.children, depth + 1);
  });
}