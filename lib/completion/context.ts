import {
  getMindmapSectionContext,
  type EditorCursorPosition,
  type MindmapSectionContext,
} from '../dsl/editor-context.ts';

export interface InlineCompletionContextWindow {
  recentText: string;
  linePrefix: string;
  cursor: EditorCursorPosition;
  section: MindmapSectionContext;
  currentLineWithCursor: string;
  currentBranchAndSubbranch: string;
}

export interface InlineCompletionContextWindowOptions {
  recentTokenBudget?: number;
  cursorMarker?: string;
}

const defaultRecentTokenBudget = 160;
const defaultCursorMarker = '<CURSOR>';

export function extractInlineCompletionContextWindow(
  outline: string,
  cursor: EditorCursorPosition,
  options: InlineCompletionContextWindowOptions = {},
): InlineCompletionContextWindow {
  const section = getMindmapSectionContext(outline, cursor);
  const recentTokenBudget = options.recentTokenBudget ?? defaultRecentTokenBudget;
  const cursorMarker = options.cursorMarker ?? defaultCursorMarker;

  return {
    recentText: getRecentTextWindow(outline, recentTokenBudget),
    linePrefix: section.currentLinePrefix,
    cursor: section.cursor,
    section,
    currentLineWithCursor: insertCursorMarker(section.currentLine, section.cursor.column, cursorMarker),
    currentBranchAndSubbranch: formatStructuralContext(section),
  };
}

export function getRecentTextWindow(outline: string, tokenBudget: number): string {
  const trimmedOutline = outline.trim();

  if (trimmedOutline.length === 0) {
    return '';
  }

  const tokens = trimmedOutline.split(/\s+/);

  if (tokens.length <= tokenBudget) {
    return trimmedOutline;
  }

  return tokens.slice(-tokenBudget).join(' ');
}

export function insertCursorMarker(
  line: string,
  column: number,
  cursorMarker = defaultCursorMarker,
): string {
  const safeOffset = Math.max(0, Math.min(line.length, column - 1));
  return `${line.slice(0, safeOffset)}${cursorMarker}${line.slice(safeOffset)}`;
}

export function formatStructuralContext(section: MindmapSectionContext): string {
  const lines = [
    `Root: ${section.rootLabel ?? 'None'}`,
    `Branch: ${section.branchLabel ?? 'None'}`,
  ];

  if (section.subBranchTrail.length > 0) {
    lines.push(`Sub-branch: ${section.subBranchTrail.join(' -> ')}`);
  } else {
    lines.push('Sub-branch: None');
  }

  lines.push(`Line kind: ${section.currentLineKind}`);
  lines.push(`Indent level: ${section.indentLevel}`);

  return lines.join('\n');
}