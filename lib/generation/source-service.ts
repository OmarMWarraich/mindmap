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
  const detailLevel = validatedRequest.detailLevel ?? 'standard';
  const env = options.env ?? getModelProviderEnv();
  const sourceMeaningfulLineCount = countMeaningfulNonEmptyLines(validatedRequest.sourceText);
  const targetMinLineCount = Math.max(1, Math.ceil(sourceMeaningfulLineCount * minimumExpansionRatio));
  const targetMaxLineCount = Math.max(targetMinLineCount, Math.floor(sourceMeaningfulLineCount * maximumExpansionRatio));
  const prompt = createSourceMindmapGenerationPrompt({
    sourceText: validatedRequest.sourceText,
    sourceMeaningfulLineCount,
    targetMinLineCount,
    targetMaxLineCount,
    detailLevel,
  });
  let attemptCount = 1;
  let attempt = await generateDslAttempt(
    validatedRequest.sourceText,
    sourceMeaningfulLineCount,
    targetMinLineCount,
    targetMaxLineCount,
    prompt,
    env,
    options.fetchImpl,
  );

  if (!attempt.validation.expansionTargetSatisfied || attempt.validation.underdevelopedBranches.length > 0) {
    const retryPrompt = createSourceMindmapGenerationPrompt({
      sourceText: validatedRequest.sourceText,
      sourceMeaningfulLineCount,
      targetMinLineCount,
      targetMaxLineCount,
      detailLevel,
      previousDslAttempt: attempt.dsl,
      retryReason: summarizeRetryReason(attempt.validation),
    });

    attemptCount += 1;
    attempt = await generateDslAttempt(
      validatedRequest.sourceText,
      sourceMeaningfulLineCount,
      targetMinLineCount,
      targetMaxLineCount,
      retryPrompt,
      env,
      options.fetchImpl,
    );
  }

  const dsl = attempt.dsl;
  const parseResult = attempt.parseResult;
  const generatedMeaningfulLineCount = attempt.metrics.generatedMeaningfulLineCount;
  const expansionRatio = attempt.metrics.expansionRatio;
  const lineWordLimitSatisfied = attempt.validation.lineWordLimitSatisfied;

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
      expansionTargetSatisfied: attempt.validation.expansionTargetSatisfied,
    },
    quality: {
      attemptCount,
      mode: attemptCount > 1 ? 'retry' : 'first-pass',
      densityStatus: attempt.validation.expansionTargetSatisfied ? 'target-met' : 'below-target',
      underdevelopedBranchCount: attempt.validation.underdevelopedBranches.length,
    },
  });
}

function summarizeRetryReason(validation: DslAttemptResult['validation']): string {
  if (!validation.expansionTargetSatisfied && validation.underdevelopedBranches.length > 0) {
    return `The outline is too sparse and these branches need child lines: ${validation.underdevelopedBranches.join(', ')}.`;
  }

  if (!validation.expansionTargetSatisfied) {
    return 'The outline is too sparse for the target line-count range.';
  }

  return `These branches need more child lines: ${validation.underdevelopedBranches.join(', ')}.`;
}

interface DslAttemptResult {
  dsl: string;
  parseResult: ReturnType<typeof parseMindmapDsl>;
  metrics: {
    generatedMeaningfulLineCount: number;
    expansionRatio: number;
  };
  validation: {
    lineWordLimitSatisfied: boolean;
    expansionTargetSatisfied: boolean;
    underdevelopedBranches: string[];
  };
}

async function generateDslAttempt(
  sourceText: string,
  sourceMeaningfulLineCount: number,
  targetMinLineCount: number,
  targetMaxLineCount: number,
  prompt: ReturnType<typeof createSourceMindmapGenerationPrompt>,
  env: ModelProviderEnv,
  fetchImpl?: typeof fetch,
): Promise<DslAttemptResult> {
  const completionText = await requestModelProviderChatCompletion({
    env,
    fetchImpl,
    model: env.MODEL_GENERATION_MODEL,
    maxCompletionTokens: 2200,
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
  const resolvedDsl = resolveParserSafeDsl(parsedModelResponse.dsl, sourceText);
  const generatedMeaningfulLineCount = countMeaningfulNonEmptyLines(resolvedDsl.dsl);
  const expansionRatio = sourceMeaningfulLineCount === 0
    ? generatedMeaningfulLineCount
    : generatedMeaningfulLineCount / sourceMeaningfulLineCount;
  const lineWordLimitSatisfied = getMaxWordCountPerLine(resolvedDsl.dsl) <= maxWordsPerLine;

  if (!lineWordLimitSatisfied) {
    throw new Error('Generated DSL exceeded the 15-word per-line limit.');
  }

  return {
    dsl: resolvedDsl.dsl,
    parseResult: resolvedDsl.parseResult,
    metrics: {
      generatedMeaningfulLineCount,
      expansionRatio,
    },
    validation: {
      lineWordLimitSatisfied,
      expansionTargetSatisfied: generatedMeaningfulLineCount >= targetMinLineCount,
      underdevelopedBranches: findUnderdevelopedBranches(resolvedDsl.dsl),
    },
  };
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

function resolveParserSafeDsl(
  generatedDsl: string,
  sourceText: string,
): {
  dsl: string;
  parseResult: ReturnType<typeof parseMindmapDsl>;
} {
  const primaryDsl = normalizeGeneratedDsl(generatedDsl);
  const primaryParseResult = parseMindmapDsl(primaryDsl);

  if (primaryParseResult.ast && primaryParseResult.errors.length === 0) {
    return {
      dsl: primaryDsl,
      parseResult: primaryParseResult,
    };
  }

  const structuredCandidates = [generatedDsl, sourceText]
    .map(convertStructuredTopicLabelsToDsl)
    .filter((candidate): candidate is string => candidate != null);

  for (const candidate of structuredCandidates) {
    const normalizedCandidate = normalizeGeneratedDsl(candidate);
    const candidateParseResult = parseMindmapDsl(normalizedCandidate);

    if (candidateParseResult.ast && candidateParseResult.errors.length === 0) {
      return {
        dsl: normalizedCandidate,
        parseResult: candidateParseResult,
      };
    }
  }

  throw new Error('Generated DSL did not pass parser validation.');
}

function convertStructuredTopicLabelsToDsl(input: string): string | null {
  const entries = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseStructuredTopicLine)
    .filter((entry): entry is StructuredTopicEntry => entry != null);

  if (entries.length === 0 || !entries.some((entry) => entry.kind === 'main')) {
    return null;
  }

  const mainTopics = groupStructuredEntriesByMainTopic(entries);

  if (mainTopics.length === 0) {
    return null;
  }

  if (mainTopics.length === 1) {
    return buildSingleMainTopicDsl(mainTopics[0]!);
  }

  return buildMultiMainTopicDsl(mainTopics);
}

type StructuredTopicEntry =
  | { kind: 'main'; label: string }
  | { kind: 'sub'; label: string }
  | { kind: 'subsub'; label: string }
  | { kind: 'detail'; label: string };

interface StructuredMainTopicGroup {
  label: string;
  notes: string[];
  subtopics: Array<{
    label: string;
    notes: string[];
    subsubtopics: Array<{
      label: string;
      notes: string[];
    }>;
  }>;
}

function parseStructuredTopicLine(line: string): StructuredTopicEntry | null {
  const patterns: Array<[StructuredTopicEntry['kind'], RegExp]> = [
    ['main', /^main\s+topic\s*:\s*(.+)$/iu],
    ['sub', /^sub\s+topic\s*:\s*(.+)$/iu],
    ['subsub', /^sub(?:[-\s]+sub)\s*topic\s*:\s*(.+)$/iu],
    ['detail', /^(?:detailed\s+note|detail|note|explanation|example)\s*:\s*(.+)$/iu],
  ];

  for (const [kind, pattern] of patterns) {
    const match = line.match(pattern);

    if (match) {
      return {
        kind,
        label: match[1]!.trim(),
      };
    }
  }

  return null;
}

function groupStructuredEntriesByMainTopic(entries: StructuredTopicEntry[]): StructuredMainTopicGroup[] {
  const mainTopics: StructuredMainTopicGroup[] = [];
  let currentMainTopic: StructuredMainTopicGroup | null = null;
  let currentSubtopic: StructuredMainTopicGroup['subtopics'][number] | null = null;
  let currentSubsubtopic: StructuredMainTopicGroup['subtopics'][number]['subsubtopics'][number] | null = null;

  for (const entry of entries) {
    if (entry.kind === 'main') {
      currentMainTopic = {
        label: entry.label,
        notes: [],
        subtopics: [],
      };
      mainTopics.push(currentMainTopic);
      currentSubtopic = null;
      currentSubsubtopic = null;
      continue;
    }

    if (!currentMainTopic) {
      continue;
    }

    if (entry.kind === 'sub') {
      currentSubtopic = {
        label: entry.label,
        notes: [],
        subsubtopics: [],
      };
      currentMainTopic.subtopics.push(currentSubtopic);
      currentSubsubtopic = null;
      continue;
    }

    if (entry.kind === 'subsub') {
      if (!currentSubtopic) {
        currentSubtopic = {
          label: 'Overview',
          notes: [],
          subsubtopics: [],
        };
        currentMainTopic.subtopics.push(currentSubtopic);
      }

      currentSubsubtopic = {
        label: entry.label,
        notes: [],
      };
      currentSubtopic.subsubtopics.push(currentSubsubtopic);
      continue;
    }

    if (entry.kind === 'detail') {
      if (currentSubsubtopic) {
        currentSubsubtopic.notes.push(entry.label);
        continue;
      }

      if (currentSubtopic) {
        currentSubtopic.notes.push(entry.label);
        continue;
      }

      currentMainTopic.notes.push(entry.label);
    }
  }

  return mainTopics;
}

function buildSingleMainTopicDsl(mainTopic: StructuredMainTopicGroup): string {
  const lines = [`@root: ${mainTopic.label}`];

  if (mainTopic.notes.length > 0) {
    lines.push('- @branch: Overview');
    mainTopic.notes.forEach((note) => {
      lines.push(`  - ${note}`);
    });
  }

  mainTopic.subtopics.forEach((subtopic) => {
    lines.push(`- @branch: ${subtopic.label}`);

    subtopic.notes.forEach((note) => {
      lines.push(`  - ${note}`);
    });

    subtopic.subsubtopics.forEach((subsubtopic) => {
      lines.push(`  - ${subsubtopic.label}`);
      subsubtopic.notes.forEach((note) => {
        lines.push(`    - ${note}`);
      });
    });
  });

  return lines.join('\n');
}

function buildMultiMainTopicDsl(mainTopics: StructuredMainTopicGroup[]): string {
  const lines = ['@root: Study Topics'];

  mainTopics.forEach((mainTopic) => {
    lines.push(`- @branch: ${mainTopic.label}`);

    mainTopic.notes.forEach((note) => {
      lines.push(`  - ${note}`);
    });

    mainTopic.subtopics.forEach((subtopic) => {
      lines.push(`  - ${subtopic.label}`);

      subtopic.notes.forEach((note) => {
        lines.push(`    - ${note}`);
      });

      subtopic.subsubtopics.forEach((subsubtopic) => {
        lines.push(`    - ${subsubtopic.label}`);
        subsubtopic.notes.forEach((note) => {
          lines.push(`      - ${note}`);
        });
      });
    });
  });

  return lines.join('\n');
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

function findUnderdevelopedBranches(input: string): string[] {
  const lines = input.split(/\r?\n/);
  const underdevelopedBranches: string[] = [];
  let currentBranchLabel: string | null = null;
  let currentBranchChildCount = 0;

  for (const line of lines) {
    const branchMatch = line.match(/^-\s@branch:\s(.+)$/u);

    if (branchMatch) {
      if (currentBranchLabel && currentBranchChildCount < 2) {
        underdevelopedBranches.push(currentBranchLabel);
      }

      currentBranchLabel = branchMatch[1]!.trim();
      currentBranchChildCount = 0;
      continue;
    }

    if (currentBranchLabel && /^\s{2,}-\s.+$/u.test(line)) {
      currentBranchChildCount += 1;
    }
  }

  if (currentBranchLabel && currentBranchChildCount < 2) {
    underdevelopedBranches.push(currentBranchLabel);
  }

  return underdevelopedBranches;
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