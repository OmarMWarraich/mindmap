const headingLabelByDepth = [
  'Main Topic',
  'Sub Topic',
  'Sub sub Topic',
  'Sub sub sub Topic',
  'Sub sub sub sub Topic',
] as const;

const verbLikePatterns = [
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'include', 'includes', 'contain', 'contains',
  'show', 'shows', 'explain', 'explains', 'absorb', 'absorbs',
  'split', 'splits', 'produce', 'produces', 'occur', 'occurs',
  'depend', 'depends', 'require', 'requires', 'involve', 'involves',
  'lead', 'leads', 'cause', 'causes', 'support', 'supports', 'make', 'makes',
];

function cleanTopicLabel(label: string): string {
  return label
    .replace(/^(?:main topic|sub topic|sub sub topic|sub sub sub topic|sub sub sub sub topic)\s*:\s*/iu, '')
    .replace(/^[\-*•–—]\s*/u, '')
    .replace(/^\d+[\.)]\s*/u, '')
    .replace(/^[A-Za-z]\)\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function formatExampleLine(line: string): string {
  const cleaned = cleanTopicLabel(line)
    .replace(/^[-*•–—]\s*/u, '')
    .replace(/^\d+[\.)]\s*/u, '')
    .trim();

  return cleaned ? `- ${cleaned}` : '';
}

function canonicalizeHeadingPrefix(prefix: string): string {
  const normalized = prefix.trim().toLowerCase().replace(/\s+/gu, ' ');

  switch (normalized) {
    case 'main topic':
      return 'Main Topic';
    case 'sub topic':
      return 'Sub Topic';
    case 'sub sub topic':
      return 'Sub sub Topic';
    case 'sub sub sub topic':
      return 'Sub sub sub Topic';
    case 'sub sub sub sub topic':
      return 'Sub sub sub sub Topic';
    default:
      return prefix.trim();
  }
}

function isLikelyHeading(line: string): boolean {
  const cleaned = cleanTopicLabel(line);

  if (!cleaned || cleaned.length > 120) {
    return false;
  }

  if (/^examples?$/iu.test(cleaned)) {
    return false;
  }

  if (/^[\-*•–—]/u.test(line) || /^\d+[\.)]/u.test(line)) {
    return false;
  }

  if (cleaned.includes(':')) {
    return false;
  }

  const words = cleaned.split(/\s+/u).filter(Boolean);
  if (words.length === 0 || words.length > 8) {
    return false;
  }

  if (new RegExp(`\\b(?:${verbLikePatterns.join('|')})\\b`, 'iu').test(cleaned)) {
    return false;
  }

  return !/[.!?]$/.test(cleaned);
}

export function normalizeOCTText(text: string): string {
  if (typeof text !== 'string' || !text.trim()) {
    return '';
  }

  const normalized: string[] = [];
  let previousWasBlank = false;

  for (const rawLine of text.replace(/\r\n?/gu, '\n').replace(/\u00A0/gu, ' ').replace(/[\u200B-\u200D\uFEFF]/gu, '').split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (normalized.length > 0 && !previousWasBlank) {
        normalized.push('');
        previousWasBlank = true;
      }
      continue;
    }

    const collapsed = trimmed.replace(/\s+/gu, ' ');
    if (/^page\s+\d+(?:\s+of\s+\d+)?$/iu.test(collapsed)) {
      continue;
    }

    const cleaned = collapsed
      .replace(/^[\u2022•*\-–—]\s*/u, '- ')
      .replace(/^\d+[\.)]\s*/u, '- ')
      .replace(/^[A-Za-z]\)\s*/u, '- ')
      .trim();

    if (!cleaned) {
      continue;
    }

    const deduped = cleaned === normalized.at(-1) ? null : cleaned;
    if (deduped) {
      normalized.push(deduped);
      previousWasBlank = false;
    }
  }

  return normalized.join('\n').replace(/\n+$/u, '');
}

export const normalizeOCRText = normalizeOCTText;

export function convertNormalizedTextSourceNotesFormat(text: string): string {
  const normalized = normalizeOCTText(text);
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return '';
  }

  const explicitHeadingPattern = /^(main topic|sub topic|sub sub topic|sub sub sub topic|sub sub sub sub topic)\s*:/iu;
  if (lines.some((line) => explicitHeadingPattern.test(line))) {
    const structuredLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(main topic|sub topic|sub sub topic|sub sub sub topic|sub sub sub sub topic)\s*:\s*(.+)$/iu);
      if (headingMatch) {
        structuredLines.push(`${canonicalizeHeadingPrefix(headingMatch[1])}: ${cleanTopicLabel(headingMatch[2])}`);
        continue;
      }

      if (/^examples?\s*:?$/iu.test(line)) {
        structuredLines.push('Examples:');
        continue;
      }

      const bulletCandidate = line.replace(/^[-*•–—]\s*/u, '').trim();
      if (bulletCandidate && !line.includes(':')) {
        structuredLines.push(`- ${bulletCandidate}`);
      } else {
        structuredLines.push(line);
      }
    }

    return structuredLines.join('\n');
  }

  const mainTopic = cleanTopicLabel(lines[0]);
  const output: string[] = [`Main Topic: ${mainTopic}`];
  const sectionLines: string[] = [];
  const exampleLines: string[] = [];
  let topicDepth = 0;

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (isLikelyHeading(line)) {
      topicDepth = Math.min(topicDepth + 1, headingLabelByDepth.length - 1);
      sectionLines.push(`${headingLabelByDepth[topicDepth]}: ${cleanTopicLabel(line)}`);
      continue;
    }

    if (/^examples?\s*:?$/iu.test(line)) {
      exampleLines.push('Examples:');
      continue;
    }

    exampleLines.push(formatExampleLine(line));
  }

  if (sectionLines.length > 0) {
    output.push('');
    output.push(...sectionLines);
  }

  if (exampleLines.length > 0) {
    output.push('Examples:');
    output.push('');
    output.push(...exampleLines.filter(Boolean).filter((value) => value !== 'Examples:'));
  }

  return output.join('\n');
}
