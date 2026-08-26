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
