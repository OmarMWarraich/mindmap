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
const detailedMaximumExpansionRatio = 3.2;
const maxWordsPerLine = 15;

type DensityStatus = 'below-target' | 'target-met' | 'over-target';

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
  const baseTargetMinLineCount = Math.max(1, Math.ceil(sourceMeaningfulLineCount * minimumExpansionRatio));
  const baseTargetMaxLineCount = Math.max(
    baseTargetMinLineCount,
    Math.floor(sourceMeaningfulLineCount * maximumExpansionRatio),
  );
  const minimumChildrenPerBranch = getMinimumChildrenPerBranch(detailLevel);
  const effectiveTargetMaxLineCount = getEffectiveTargetMaxLineCount(
    detailLevel,
    sourceMeaningfulLineCount,
    baseTargetMaxLineCount,
  );
  const effectiveTargetMinLineCount = getEffectiveTargetMinLineCount(
    detailLevel,
    baseTargetMinLineCount,
    effectiveTargetMaxLineCount,
  );
  const prompt = createSourceMindmapGenerationPrompt({
    sourceText: validatedRequest.sourceText,
    sourceMeaningfulLineCount,
    targetMinLineCount: effectiveTargetMinLineCount,
    targetMaxLineCount: effectiveTargetMaxLineCount,
    detailLevel,
    minimumChildrenPerBranch,
  });
  let attemptCount = 1;
  let attempt = await generateDslAttempt(
    validatedRequest.sourceText,
    sourceMeaningfulLineCount,
    effectiveTargetMinLineCount,
    effectiveTargetMaxLineCount,
    detailLevel,
    minimumChildrenPerBranch,
    prompt,
    env,
    options.fetchImpl,
  );

  if (shouldRetryGeneration(detailLevel, attempt.validation)) {
    const retryFeedback = describeRetryNeeds(attempt.validation);
    const retryPrompt = createSourceMindmapGenerationPrompt({
      sourceText: validatedRequest.sourceText,
      sourceMeaningfulLineCount,
      targetMinLineCount: effectiveTargetMinLineCount,
      targetMaxLineCount: effectiveTargetMaxLineCount,
      detailLevel,
      minimumChildrenPerBranch,
      previousDslAttempt: attempt.dsl,
      retryReason: retryFeedback.reason,
      retryGuidance: retryFeedback.guidance,
    });

    attemptCount += 1;
    attempt = await generateDslAttempt(
      validatedRequest.sourceText,
      sourceMeaningfulLineCount,
      effectiveTargetMinLineCount,
      effectiveTargetMaxLineCount,
      detailLevel,
      minimumChildrenPerBranch,
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
      targetMinLineCount: effectiveTargetMinLineCount,
      targetMaxLineCount: effectiveTargetMaxLineCount,
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
      densityStatus: attempt.validation.densityStatus,
      underdevelopedBranchCount: attempt.validation.underdevelopedBranches.length,
    },
  });
}

function shouldRetryGeneration(
  detailLevel: SourceMindmapGenerationRequest['detailLevel'],
  validation: DslAttemptResult['validation'],
): boolean {
  return validation.densityStatus === 'below-target'
    || validation.underdevelopedBranches.length > 0
    || validation.overlyExtractive
    || (detailLevel === 'standard' && validation.densityStatus === 'over-target');
}

function describeRetryNeeds(validation: DslAttemptResult['validation']): {
  reason: string;
  guidance: string;
} {
  if (validation.overlyExtractive) {
    return {
      reason: 'The outline copies source labels too literally instead of rewriting them into explanatory child lines.',
      guidance: [
        'Keep the same topic coverage, but rewrite copied headings into short explanations.',
        'Replace mirrored note labels with explanatory child lines wherever possible.',
        'Prefer concrete clarifications and examples over repeated labels.',
      ].join('\n'),
    };
  }

  if (validation.densityStatus === 'below-target' && validation.underdevelopedBranches.length > 0) {
    return {
      reason: `The outline is too sparse and these branches need child lines: ${validation.underdevelopedBranches.join(', ')}.`,
      guidance: [
        'Keep the same topic coverage, but add concise explanatory child lines.',
        'Develop the listed branches before adding new top-level branches.',
        'Prefer one more valid child line over an underdeveloped branch.',
      ].join('\n'),
    };
  }

  if (validation.densityStatus === 'below-target') {
    return {
      reason: 'The outline is too sparse for the target line-count range.',
      guidance: [
        'Keep the same topic coverage, but add concise explanatory child lines.',
        'Expand branches with clarifications, mechanisms, examples, or outcomes.',
        'Approach the requested line-count range without padding individual lines.',
      ].join('\n'),
    };
  }

   if (validation.densityStatus === 'over-target' && validation.underdevelopedBranches.length > 0) {
     return {
       reason: `The outline is too dense for the target line-count range, but these branches still need child lines: ${validation.underdevelopedBranches.join(', ')}.`,
       guidance: [
         'Keep the same topic coverage while condensing overlapping or repetitive child lines.',
         'Develop the listed branches to the required child-line minimum before trimming elsewhere.',
         'Reduce denser branches first so branch coverage stays balanced.',
       ].join('\n'),
     };
   }

  if (validation.densityStatus === 'over-target') {
    return {
      reason: 'The outline is too dense for the target line-count range.',
      guidance: [
        'Keep the same topic coverage, but condense overlapping child lines.',
        'Trim padding and near-duplicate details so the outline lands closer to the target range.',
        'Prefer fewer stronger child lines over repetitive bullets.',
      ].join('\n'),
    };
  }

  return {
    reason: `These branches need more child lines: ${validation.underdevelopedBranches.join(', ')}.`,
    guidance: [
      'Keep the same topic coverage, but add concise explanatory child lines.',
      'Develop the listed branches before broadening other sections.',
      'Replace mirrored note labels with short explanatory rewrites wherever possible.',
    ].join('\n'),
  };
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
    densityStatus: DensityStatus;
    underdevelopedBranches: string[];
    overlyExtractive: boolean;
  };
}

function getDensityStatus(
  generatedMeaningfulLineCount: number,
  targetMinLineCount: number,
  targetMaxLineCount: number,
): DensityStatus {
  if (generatedMeaningfulLineCount < targetMinLineCount) {
    return 'below-target';
  }

  if (generatedMeaningfulLineCount > targetMaxLineCount) {
    return 'over-target';
  }

  return 'target-met';
}

async function generateDslAttempt(
  sourceText: string,
  sourceMeaningfulLineCount: number,
  targetMinLineCount: number,
  targetMaxLineCount: number,
  detailLevel: SourceMindmapGenerationRequest['detailLevel'],
  minimumChildrenPerBranch: number,
  prompt: ReturnType<typeof createSourceMindmapGenerationPrompt>,
  env: ModelProviderEnv,
  fetchImpl?: typeof fetch,
): Promise<DslAttemptResult> {
  const completionText = await requestModelProviderChatCompletion({
    env,
    fetchImpl,
    model: env.MODEL_GENERATION_MODEL,
    maxCompletionTokens: detailLevel === 'detailed' ? 3200 : 2200,
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
  const densityStatus = getDensityStatus(
    generatedMeaningfulLineCount,
    targetMinLineCount,
    targetMaxLineCount,
  );
  const lineWordLimitSatisfied = getMaxWordCountPerLine(resolvedDsl.dsl) <= maxWordsPerLine;
  const overlyExtractive = detailLevel === 'detailed'
    ? isOverlyExtractiveDetailedDsl(resolvedDsl.dsl, sourceText)
    : false;

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
      expansionTargetSatisfied: densityStatus === 'target-met',
      densityStatus,
      underdevelopedBranches: findUnderdevelopedBranches(resolvedDsl.dsl, minimumChildrenPerBranch),
      overlyExtractive,
    },
  };
}

function getMinimumChildrenPerBranch(detailLevel: SourceMindmapGenerationRequest['detailLevel']): number {
  return detailLevel === 'detailed' ? 3 : 2;
}

function getEffectiveTargetMinLineCount(
  detailLevel: SourceMindmapGenerationRequest['detailLevel'],
  targetMinLineCount: number,
  targetMaxLineCount: number,
): number {
  if (detailLevel !== 'detailed') {
    return targetMinLineCount;
  }

  return Math.max(targetMinLineCount, Math.ceil((targetMinLineCount + targetMaxLineCount) / 2));
}

function getEffectiveTargetMaxLineCount(
  detailLevel: SourceMindmapGenerationRequest['detailLevel'],
  sourceMeaningfulLineCount: number,
  targetMaxLineCount: number,
): number {
  if (detailLevel !== 'detailed') {
    return targetMaxLineCount;
  }

  return Math.max(targetMaxLineCount, Math.ceil(sourceMeaningfulLineCount * detailedMaximumExpansionRatio));
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

function findUnderdevelopedBranches(input: string, minimumChildrenPerBranch = 2): string[] {
  const lines = input.split(/\r?\n/);
  const underdevelopedBranches: string[] = [];
  let currentBranchLabel: string | null = null;
  let currentBranchChildCount = 0;

  for (const line of lines) {
    const branchMatch = line.match(/^-\s@branch:\s(.+)$/u);

    if (branchMatch) {
      if (currentBranchLabel && currentBranchChildCount < minimumChildrenPerBranch) {
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

  if (currentBranchLabel && currentBranchChildCount < minimumChildrenPerBranch) {
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

function isOverlyExtractiveDetailedDsl(dsl: string, sourceText: string): boolean {
  const normalizedSourceLines = new Set(
    sourceText
      .split(/\r?\n/)
      .map(normalizeSimilarityLine)
      .filter((line) => line.length > 0),
  );

  if (normalizedSourceLines.size === 0) {
    return false;
  }

  const childLines = dsl
    .split(/\r?\n/)
    .filter((line) => /^\s{2,}-\s.+$/u.test(line))
    .map((line) => line.replace(/^\s*[-]\s*/u, ''))
    .map(normalizeSimilarityLine)
    .filter((line) => line.length > 0);

  if (childLines.length < 2) {
    return false;
  }

  const mirroredChildLineCount = childLines.filter((line) => normalizedSourceLines.has(line)).length;
  return mirroredChildLineCount >= Math.max(2, Math.ceil(childLines.length * 0.34));
}

function normalizeSimilarityLine(line: string): string {
  return line
    .replace(/^@root:\s*/u, '')
    .replace(/^\s*-\s*@branch:\s*/u, '')
    .replace(/^\s*-\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}