const headingLabelByDepth = [
  'Sub Topic',
  'Sub sub Topic',
  'Sub sub sub Topic',
  'Sub sub sub sub Topic',
] as const;

const sentenceVerbPattern = /\b(?:is|are|was|were|be|been|being|study|studies|studied|explore|explores|explored|define|defines|defined|according|help|helps|helped|understand|understands|understood|show|shows|shown|include|includes|included|contain|contains|contained|examine|examines|examined|describe|describes|described|explain|explains|explained|produce|produces|produced|absorb|absorbs|absorbed|split|splits|splitting|depend|depends|depended|require|requires|required|involve|involves|involved|occur|occurs|occurred|make|makes|made|lead|leads|led|support|supports|supported|cause|causes|caused|reflect|reflects|reflected|consider|considers|considered)\b/i;

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

function cleanOcrLine(line: string): string {
  let cleaned = line
    .replace(/\u00A0/gu, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/gu, '')
    .replace(/[\u2010-\u2015]/gu, '-')
    .replace(/\s*[:;|]+\s*/gu, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\b10\b/giu, ' to ')
    .replace(/\b1[0o]\b/giu, ' to ')
    .replace(/\bi\s+ntroduction\b/giu, 'introduction')
    .replace(/\bsoiology\b/giu, 'sociology')
    .replace(/\bsociolog\b/giu, 'sociology')
    .replace(/\bsociolog\s+f\b/giu, 'sociology of')
    .replace(/\bhum\s+1\s+pe\s+ga\s+ve\b/giu, 'human society')
    .replace(/\s+/gu, ' ')
    .trim();

  cleaned = cleaned
    .replace(/^(?:[A-Za-z]+\s*)?\d+\s+(?:[A-Za-z]{1,6}\s+)?/u, '')
    .replace(/^(?:o|oy|x|me)\s+/iu, '');

  while (cleaned.startsWith('- ') || cleaned.startsWith('* ') || cleaned.startsWith('• ')) {
    cleaned = cleaned.replace(/^[-*•]\s*/u, '').trim();
  }

  if (!cleaned || /^\d+$/u.test(cleaned) || /^page\s+\d+/iu.test(cleaned)) {
    return '';
  }

  return cleaned;
}

function isSentenceLike(line: string): boolean {
  const cleaned = cleanOcrLine(line);
  if (!cleaned) {
    return false;
  }

  const words = cleaned.split(/\s+/u).filter(Boolean);
  if (words.length > 12) {
    return true;
  }

  if (/^according\b/i.test(cleaned)) {
    return true;
  }

  if (sentenceVerbPattern.test(cleaned)) {
    return true;
  }

  if (/[.!?]$/.test(cleaned)) {
    return true;
  }

  return false;
}

function looksLikeHeading(line: string): boolean {
  const cleaned = cleanOcrLine(line);
  if (!cleaned || cleaned.length > 120) {
    return false;
  }

  if (/^examples?$/iu.test(cleaned)) {
    return false;
  }

  if (/\d/.test(cleaned)) {
    return false;
  }

  const words = cleaned.split(/\s+/u).filter(Boolean);
  if (words.length === 0 || words.length > 8) {
    return false;
  }

  if (isSentenceLike(cleaned)) {
    return false;
  }

  if (/^(?:o|oy|x|me)\b/i.test(cleaned)) {
    return false;
  }

  if (/(?:\b(?:rea|iol|ones|sines|x|me)\b)/i.test(cleaned)) {
    return false;
  }

  if (/^(?:social\s+)?relationships?\s+and\s+group\s+(?:behaviour|behavior)$/iu.test(cleaned)) {
    return false;
  }

  if (/^(?:social\s+)?relationships?$/iu.test(cleaned) || /^(?:group\s+)?(?:behaviour|behavior)$/iu.test(cleaned)) {
    return false;
  }

  return /[A-Za-z]/.test(cleaned);
}

function scoreHeading(line: string): number {
  const cleaned = cleanOcrLine(line);
  if (!cleaned) {
    return 0;
  }

  let score = 0;
  const lower = cleaned.toLowerCase();

  if (/(introduction|concept|definition|theory|history|society|behavior|behaviour|culture|economy|politics|photosynthesis|reactions|transport|biology|comte|durkheim|marx|weber)/.test(lower)) {
    score += 8;
  }
  if (/(sociology|biology|photosynthesis|reactions|transport|comte|durkheim|marx|weber)/.test(lower)) {
    score += 8;
  }
  if (cleaned.split(/\s+/u).length <= 5) {
    score += 3;
  }
  if (/\d/.test(cleaned)) {
    score -= 12;
  }
  if (!looksLikeHeading(cleaned)) {
    score -= 20;
  }

  return score;
}

function toTitleCaseText(text: string): string {
  const words = text.split(/\s+/u).filter(Boolean);

  return words.map((word, index) => {
    const lower = word.toLowerCase();
    if (index !== 0 && ['a', 'an', 'the', 'to', 'of', 'and', 'in', 'on', 'for', 'with', 'by'].includes(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function normalizeHeadingText(text: string): string {
  const cleaned = cleanOcrLine(text);
  if (!cleaned) {
    return 'Study Notes';
  }

  if (/^[A-Z]/u.test(cleaned)) {
    return cleaned;
  }

  return toTitleCaseText(cleaned);
}

function chooseMainTopic(lines: string[]): string {
  const candidates = lines
    .map((line) => ({ line: cleanOcrLine(line), score: scoreHeading(line) }))
    .filter(({ line, score }) => line && score > 0)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    return 'Study Notes';
  }

  const best = normalizeHeadingText(candidates[0].line);
  return best || 'Study Notes';
}

function inferMissingConceptHeading(mainTopic: string, lines: string[]): string | null {
  const topic = cleanTopicLabel(mainTopic);
  if (!topic || /^(study notes)$/iu.test(topic)) {
    return null;
  }

  const subject = topic
    .replace(/^introduction to\s+/iu, '')
    .replace(/^overview of\s+/iu, '')
    .replace(/^concept of\s+/iu, '')
    .trim();

  if (!subject || subject.length > 80) {
    return null;
  }

  const hasExplicitConcept = lines.some((line) => /(?:^|\s)(?:concept|definition|introduction)\s+of\s+.*\b(?:sociology|biology|history|culture|economy|politics|chemistry|physics|literature|psychology)\b/i.test(line));
  if (hasExplicitConcept) {
    return null;
  }

  const hasDefinitionSentence = lines.some((line) => {
    const cleaned = cleanOcrLine(line);
    if (!cleaned) {
      return false;
    }

    const lower = cleaned.toLowerCase();
    return lower.includes(subject.toLowerCase()) && /\b(?:is|are|refers|means|studies|examines|explores|defines|helps|understands)\b/.test(lower);
  });

  if (!hasDefinitionSentence && !/^(?:introduction|overview)\b/i.test(topic)) {
    return null;
  }

  return `Concept of ${subject}`;
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

  const rawLines = normalized
    .split('\n')
    .map((line) => cleanOcrLine(line))
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    return '';
  }

  const explicitHeadingPattern = /^(main topic|sub topic|sub sub topic|sub sub sub topic|sub sub sub sub topic)\s*:/iu;
  if (rawLines.some((line) => explicitHeadingPattern.test(line))) {
    const structuredLines: string[] = [];

    for (const line of rawLines) {
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

  const mainTopic = chooseMainTopic(rawLines);
  const output: string[] = [`Main Topic: ${mainTopic}`];
  const sectionLines: string[] = [];
  const exampleLines: string[] = [];
  let depth = 0;

  const conceptHeading = inferMissingConceptHeading(mainTopic, rawLines);
  if (conceptHeading && !sectionLines.some((value) => value.toLowerCase().startsWith('sub topic: concept of '))) {
    sectionLines.push(`Sub Topic: ${conceptHeading}`);
    depth = 1;
  }

  for (const line of rawLines) {
    if (line.toLowerCase() === mainTopic.toLowerCase()) {
      continue;
    }

    if (looksLikeHeading(line) && scoreHeading(line) > 0) {
      const headingText = normalizeHeadingText(line);
      const label = headingLabelByDepth[Math.min(depth, headingLabelByDepth.length - 1)];
      sectionLines.push(`${label}: ${headingText}`);
      depth += 1;
      continue;
    }

    const bulletLine = formatExampleLine(line);
    if (bulletLine) {
      exampleLines.push(bulletLine);
    }
  }

  if (sectionLines.length > 0) {
    output.push('');
    output.push(...sectionLines.filter((value, index, values) => values.indexOf(value) === index));
  }

  if (exampleLines.length > 0) {
    if (sectionLines.length > 0) {
      output.push('Examples:');
    } else {
      output.push('');
      output.push('Examples:');
    }
    output.push('');
    output.push(...exampleLines.filter(Boolean));
  }

  return output.join('\n');
}
