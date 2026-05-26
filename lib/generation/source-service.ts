import { getModelProviderEnv, type ModelProviderEnv } from '../config/env.ts';
import { requestModelProviderChatCompletion } from '../completion/provider.ts';
import { parseMindmapDsl } from '../dsl/parse.ts';
import {
  createSourceMindmapGenerationPrompt,
} from './source-prompt.ts';
import {
  parseSourceMindmapModelResponse,
  sourceMindmapGenerationRequestSchema,
  sourceMindmapGenerationResponseSchema,
  sourceMindmapModelResponseJsonSchema,
  type SourceMindmapGenerationRequest,
  type SourceMindmapGenerationResponse,
} from './source-schema.ts';

const minimumExpansionRatio = 2.3;
const maximumExpansionRatio = 2.7;
const maxWordsPerLine = 15;

export { sourceMindmapGenerationRequestSchema };

export async function generateMindmapDslFromSource(
  request: SourceMindmapGenerationRequest,
  options: {
    env?: ModelProviderEnv;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<SourceMindmapGenerationResponse> {
  const validatedRequest = sourceMindmapGenerationRequestSchema.parse(request);
  const env = options.env ?? getModelProviderEnv();
  const sourceMeaningfulLineCount = countMeaningfulNonEmptyLines(validatedRequest.sourceText);
  const targetMinLineCount = Math.max(1, Math.ceil(sourceMeaningfulLineCount * minimumExpansionRatio));
  const targetMaxLineCount = Math.max(targetMinLineCount, Math.floor(sourceMeaningfulLineCount * maximumExpansionRatio));
  const prompt = createSourceMindmapGenerationPrompt({
    sourceText: validatedRequest.sourceText,
    sourceMeaningfulLineCount,
    targetMinLineCount,
    targetMaxLineCount,
  });
  const completionText = await requestModelProviderChatCompletion({
    env,
    fetchImpl: options.fetchImpl,
    model: env.MODEL_GENERATION_MODEL,
    maxCompletionTokens: 1600,
    temperature: 0.2,
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'mindmap_source_to_dsl',
        strict: true,
        schema: sourceMindmapModelResponseJsonSchema,
      },
    },
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
  });

  const parsedModelResponse = parseSourceMindmapModelResponse(completionText);
  const dsl = normalizeGeneratedDsl(parsedModelResponse.dsl);
  const parseResult = parseMindmapDsl(dsl);
  const generatedMeaningfulLineCount = countMeaningfulNonEmptyLines(dsl);
  const expansionRatio = sourceMeaningfulLineCount === 0
    ? generatedMeaningfulLineCount
    : generatedMeaningfulLineCount / sourceMeaningfulLineCount;
  const lineWordLimitSatisfied = getMaxWordCountPerLine(dsl) <= maxWordsPerLine;

  if (!parseResult.ast || parseResult.errors.length > 0) {
    throw new Error('Generated DSL did not pass parser validation.');
  }

  if (!lineWordLimitSatisfied) {
    throw new Error('Generated DSL exceeded the 15-word per-line limit.');
  }

  return sourceMindmapGenerationResponseSchema.parse({
    dsl,
    metrics: {
      sourceMeaningfulLineCount,
      generatedMeaningfulLineCount,
      expansionRatio,
      targetMinLineCount,
      targetMaxLineCount,
      maxWordsPerLine,
    },
    validation: {
      parserWarnings: parseResult.warnings,
      parserErrors: parseResult.errors,
      lineWordLimitSatisfied,
      expansionTargetSatisfied: generatedMeaningfulLineCount >= targetMinLineCount
        && generatedMeaningfulLineCount <= targetMaxLineCount,
    },
  });
}

export function countMeaningfulNonEmptyLines(input: string): number {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .length;
}

export function normalizeGeneratedDsl(input: string): string {
  return input
    .split(/\r?\n/)
    .filter((line) => !/^```[a-zA-Z-]*\s*$/u.test(line.trim()))
    .map((line) => line.replace(/\s+$/u, ''))
    .filter((line, index, lines) => line.trim().length > 0 || hasNonEmptyNeighbor(lines, index))
    .join('\n')
    .trim();
}

function hasNonEmptyNeighbor(lines: string[], index: number): boolean {
  const previous = lines[index - 1]?.trim() ?? '';
  const next = lines[index + 1]?.trim() ?? '';

  return previous.length > 0 && next.length > 0;
}

function getMaxWordCountPerLine(input: string): number {
  return input
    .split(/\r?\n/)
    .reduce((max, line) => Math.max(max, countWordsInLine(line)), 0);
}

function countWordsInLine(line: string): number {
  const content = line
    .replace(/^\s*-\s*@branch:\s*/u, '')
    .replace(/^\s*-\s*/u, '')
    .replace(/^@root:\s*/u, '')
    .trim();

  if (content.length === 0) {
    return 0;
  }

  return content.split(/\s+/u).length;
}