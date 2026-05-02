import type { InlineCompletionContextWindow } from './context.ts';

export type InlineCompletionRelevanceReason =
  | 'empty'
  | 'off-topic'
  | 'repetitive'
  | 'overly-broad';

export interface InlineCompletionRelevanceResult {
  accepted: boolean;
  reason: InlineCompletionRelevanceReason | null;
}

const genericBroadPhrases = new Set([
  'important detail',
  'important details',
  'more information',
  'key point',
  'key points',
  'more detail',
  'general overview',
  'useful example',
]);

export function evaluateInlineCompletionRelevance(
  completionText: string,
  context: InlineCompletionContextWindow,
): InlineCompletionRelevanceResult {
  if (completionText.length === 0) {
    return { accepted: false, reason: 'empty' };
  }

  if (isOverlyBroadCompletion(completionText)) {
    return { accepted: false, reason: 'overly-broad' };
  }

  if (isRepetitiveCompletion(completionText, context.recentText)) {
    return { accepted: false, reason: 'repetitive' };
  }

  if (isOffTopicCompletion(completionText, context)) {
    return { accepted: false, reason: 'off-topic' };
  }

  return { accepted: true, reason: null };
}

function isOffTopicCompletion(
  completionText: string,
  context: InlineCompletionContextWindow,
): boolean {
  if (looksLikeContinuationSuffix(completionText)) {
    return false;
  }

  const completionTokens = getMeaningfulTokens(completionText);

  if (completionTokens.length === 0) {
    return false;
  }

  const topicTokens = new Set(getMeaningfulTokens([
    context.section.rootLabel ?? '',
    context.section.branchLabel ?? '',
    context.section.subBranchTrail.join(' '),
    context.section.currentLabelFragment,
  ].join(' ')));

  if (topicTokens.size === 0) {
    return false;
  }

  if (completionTokens.length < 3) {
    return false;
  }

  return completionTokens.every((token) => !topicTokens.has(token));
}

function isRepetitiveCompletion(completionText: string, recentText: string): boolean {
  const normalizedCompletion = normalizeForComparison(completionText);

  if (normalizedCompletion.length < 4) {
    return false;
  }

  return normalizeForComparison(recentText).includes(normalizedCompletion);
}

function isOverlyBroadCompletion(completionText: string): boolean {
  const normalized = normalizeForComparison(completionText);

  if (genericBroadPhrases.has(normalized)) {
    return true;
  }

  const tokens = getMeaningfulTokens(completionText);
  return tokens.length > 0 && tokens.every((token) => ['detail', 'details', 'overview', 'information', 'concept', 'concepts'].includes(token));
}

function looksLikeContinuationSuffix(completionText: string): boolean {
  return !completionText.includes('\n') && !completionText.includes(' ');
}

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getMeaningfulTokens(value: string): string[] {
  return normalizeForComparison(value)
    .split(' ')
    .filter((token) => token.length >= 3);
}