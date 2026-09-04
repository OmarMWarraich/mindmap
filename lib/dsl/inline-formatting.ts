export type MindmapDslInlineFormat = 'bold' | 'italic' | 'underline';

interface InlineFormatMarkers {
  prefix: string;
  suffix: string;
}

export const MINDMAP_DSL_INLINE_FORMAT_MARKERS: Record<
  MindmapDslInlineFormat,
  InlineFormatMarkers
> = {
  bold: { prefix: '**', suffix: '**' },
  italic: { prefix: '_', suffix: '_' },
  underline: { prefix: '<u>', suffix: '</u>' },
};

export function toggleMindmapDslInlineFormatting(
  selectedText: string,
  format: MindmapDslInlineFormat,
): string {
  const { prefix, suffix } = MINDMAP_DSL_INLINE_FORMAT_MARKERS[format];
  const isWrapped =
    selectedText.length >= prefix.length + suffix.length
    && selectedText.startsWith(prefix)
    && selectedText.endsWith(suffix);

  if (isWrapped) {
    return selectedText.slice(prefix.length, selectedText.length - suffix.length);
  }

  return prefix + selectedText + suffix;
}

export interface MindmapInlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface InlineStyleFlags {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

// Ordered so `<u>` wins over `_` when both start at the same index.
const inlineFormatPatterns: Array<{ pattern: RegExp; flag: keyof InlineStyleFlags }> = [
  { pattern: /\*\*(.*?)\*\*/, flag: 'bold' },
  { pattern: /<u>(.*?)<\/u>/, flag: 'underline' },
  { pattern: /_(.*?)_/, flag: 'italic' },
];

export function parseMindmapInlineSegments(text: string): MindmapInlineSegment[] {
  return mergeInlineSegments(
    collectInlineSegments(text, { bold: false, italic: false, underline: false }),
  );
}

export function stripMindmapInlineFormatting(text: string): string {
  return parseMindmapInlineSegments(text)
    .map((segment) => segment.text)
    .join('');
}

function collectInlineSegments(
  text: string,
  flags: InlineStyleFlags,
): MindmapInlineSegment[] {
  if (text.length === 0) {
    return [];
  }

  let earliest: {
    index: number;
    length: number;
    inner: string;
    flag: keyof InlineStyleFlags;
  } | null = null;

  for (const { pattern, flag } of inlineFormatPatterns) {
    const match = pattern.exec(text);

    if (!match || match[1] === undefined) {
      continue;
    }

    if (!earliest || match.index < earliest.index) {
      earliest = { index: match.index, length: match[0].length, inner: match[1], flag };
    }
  }

  if (!earliest) {
    return [{ text, ...flags }];
  }

  const before = text.slice(0, earliest.index);
  const after = text.slice(earliest.index + earliest.length);

  return [
    ...(before.length > 0 ? [{ text: before, ...flags }] : []),
    ...collectInlineSegments(earliest.inner, { ...flags, [earliest.flag]: true }),
    ...collectInlineSegments(after, flags),
  ];
}

function mergeInlineSegments(segments: MindmapInlineSegment[]): MindmapInlineSegment[] {
  const merged: MindmapInlineSegment[] = [];

  for (const segment of segments) {
    if (segment.text.length === 0) {
      continue;
    }

    const last = merged.at(-1);

    if (
      last
      && last.bold === segment.bold
      && last.italic === segment.italic
      && last.underline === segment.underline
    ) {
      last.text += segment.text;
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}
