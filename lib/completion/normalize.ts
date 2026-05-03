export interface NormalizeInlineCompletionOptions {
  currentLinePrefix: string;
}

export function normalizeInlineCompletionOutput(
  rawOutput: string,
  options: NormalizeInlineCompletionOptions,
): string {
  const withoutWrappers = stripPresentationWrappers(rawOutput)
    .replace(/\r\n?/g, '\n')
    .replace(/<CURSOR>/g, '');

  const withoutDuplicatePrefix = stripCurrentLinePrefix(
    withoutWrappers,
    options.currentLinePrefix,
  );

  return withoutDuplicatePrefix.replace(/[ \t]+$/gm, '').trimEnd();
}

export function stripPresentationWrappers(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    return trimmed.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/\n?```$/, '');
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\'')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed.slice(1, -1);
  }

  return value;
}

export function stripCurrentLinePrefix(value: string, currentLinePrefix: string): string {
  if (!currentLinePrefix) {
    return value;
  }

  for (const candidate of getInsertionPrefixCandidates(currentLinePrefix)) {
    if (candidate.length > 0 && value.startsWith(candidate)) {
      return value.slice(candidate.length);
    }
  }

  return value;
}

function getInsertionPrefixCandidates(currentLinePrefix: string): string[] {
  const candidates = new Set<string>([
    currentLinePrefix,
    currentLinePrefix.trimStart(),
  ]);
  const labelOnlyPrefix = currentLinePrefix
    .replace(/^\s*@root:\s*/, '')
    .replace(/^\s*-\s*@branch:\s*/, '')
    .replace(/^\s*-\s*/, '');

  candidates.add(labelOnlyPrefix);
  candidates.add(labelOnlyPrefix.trimStart());

  return [...candidates].filter(Boolean);
}