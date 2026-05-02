import {
  MINDMAP_DSL_BRANCH_PREFIX,
  MINDMAP_DSL_INDENT,
  MINDMAP_DSL_LEAF_PREFIX,
  MINDMAP_DSL_ROOT_PREFIX,
} from './mvp.ts';

export interface EditorCursorPosition {
  lineNumber: number;
  column: number;
}

export type MindmapSectionLineKind = 'blank' | 'root' | 'branch' | 'leaf' | 'content';

export interface MindmapSectionContext {
  cursor: EditorCursorPosition;
  currentLine: string;
  currentLinePrefix: string;
  currentLineKind: MindmapSectionLineKind;
  currentLabelFragment: string;
  indentLevel: number;
  rootLabel: string | null;
  branchLabel: string | null;
  subBranchTrail: string[];
}

interface LineDescriptor {
  kind: MindmapSectionLineKind;
  label: string;
  indentLevel: number;
}

export function getMindmapSectionContext(
  outline: string,
  cursor: EditorCursorPosition,
): MindmapSectionContext {
  const lines = outline.split(/\r?\n/);
  const lineIndex = clampLineIndex(lines, cursor.lineNumber);
  const currentLine = lines[lineIndex] ?? '';
  const currentLinePrefix = currentLine.slice(0, Math.max(cursor.column - 1, 0));

  let rootLabel: string | null = null;
  let branchLabel: string | null = null;
  let subBranchTrail: string[] = [];

  for (let index = 0; index <= lineIndex; index += 1) {
    const line = lines[index] ?? '';
    const descriptor = describeDslLine(index === lineIndex ? currentLinePrefix : line);

    if (descriptor.kind === 'root') {
      rootLabel = descriptor.label || rootLabel;
      branchLabel = null;
      subBranchTrail = [];
      continue;
    }

    if (descriptor.kind === 'branch') {
      branchLabel = descriptor.label || branchLabel;
      subBranchTrail = [];
      continue;
    }

    if (descriptor.kind === 'leaf') {
      const nextTrail = subBranchTrail.slice(0, Math.max(descriptor.indentLevel - 1, 0));
      if (descriptor.label.length > 0) {
        nextTrail[descriptor.indentLevel - 1] = descriptor.label;
      }
      subBranchTrail = nextTrail;
    }
  }

  const currentDescriptor = describeDslLine(currentLinePrefix);

  return {
    cursor: {
      lineNumber: lineIndex + 1,
      column: Math.max(cursor.column, 1),
    },
    currentLine,
    currentLinePrefix,
    currentLineKind: currentDescriptor.kind,
    currentLabelFragment: currentDescriptor.label,
    indentLevel: currentDescriptor.indentLevel,
    rootLabel,
    branchLabel,
    subBranchTrail,
  };
}

function clampLineIndex(lines: string[], lineNumber: number): number {
  if (lines.length === 0) {
    return 0;
  }

  return Math.min(Math.max(lineNumber - 1, 0), lines.length - 1);
}

function describeDslLine(raw: string): LineDescriptor {
  const indentLevel = countIndentLevel(raw);
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { kind: 'blank', label: '', indentLevel };
  }

  if (trimmed.startsWith(MINDMAP_DSL_ROOT_PREFIX.trim())) {
    return {
      kind: 'root',
      label: trimmed.slice(MINDMAP_DSL_ROOT_PREFIX.length).trim(),
      indentLevel,
    };
  }

  if (trimmed.startsWith(MINDMAP_DSL_BRANCH_PREFIX.trim())) {
    return {
      kind: 'branch',
      label: trimmed.slice(MINDMAP_DSL_BRANCH_PREFIX.length).trim(),
      indentLevel,
    };
  }

  if (trimmed.startsWith(MINDMAP_DSL_LEAF_PREFIX)) {
    return {
      kind: 'leaf',
      label: trimmed.slice(MINDMAP_DSL_LEAF_PREFIX.length).trim(),
      indentLevel,
    };
  }

  return {
    kind: 'content',
    label: trimmed,
    indentLevel,
  };
}

function countIndentLevel(raw: string): number {
  const leadingSpaces = raw.match(/^ */)?.[0].length ?? 0;
  return Math.floor(leadingSpaces / MINDMAP_DSL_INDENT.length);
}