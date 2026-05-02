import type { EditorCursorPosition } from '../dsl/editor-context.ts';
import {
  MINDMAP_DSL_BRANCH_PREFIX,
  MINDMAP_DSL_INDENT,
  MINDMAP_DSL_LEAF_PREFIX,
  MINDMAP_DSL_ROOT_PREFIX,
} from '../dsl/mvp.ts';

export interface SiblingDuplicationResult {
  accepted: boolean;
  siblingLabels: string[];
}

export function rejectDuplicateSiblingCompletion(
  completionText: string,
  outline: string,
  cursor: EditorCursorPosition,
): SiblingDuplicationResult {
  if (completionText.length === 0) {
    return { accepted: true, siblingLabels: [] };
  }

  const siblingLabels = collectNearbySiblingLabels(outline, cursor);
  const normalizedCompletion = normalizeLabel(completionText);
  const accepted = siblingLabels.every((label) => normalizeLabel(label) !== normalizedCompletion);

  return {
    accepted,
    siblingLabels,
  };
}

export function collectNearbySiblingLabels(
  outline: string,
  cursor: EditorCursorPosition,
): string[] {
  const lines = outline.split(/\r?\n/);
  const lineIndex = Math.min(Math.max(cursor.lineNumber - 1, 0), Math.max(lines.length - 1, 0));
  const currentIndentLevel = countIndentLevel(lines[lineIndex] ?? '');
  const startIndex = findSiblingBlockStart(lines, lineIndex, currentIndentLevel);
  const endIndex = findSiblingBlockEnd(lines, lineIndex, currentIndentLevel);
  const siblingLabels: string[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    if (index === lineIndex) {
      continue;
    }

    const descriptor = describeLine(lines[index] ?? '');

    if (descriptor == null || descriptor.indentLevel !== currentIndentLevel) {
      continue;
    }

    siblingLabels.push(descriptor.label);
  }

  return siblingLabels;
}

function findSiblingBlockStart(lines: string[], fromIndex: number, indentLevel: number): number {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? '';

    if (line.trim().length === 0) {
      continue;
    }

    if (countIndentLevel(line) < indentLevel) {
      return index + 1;
    }
  }

  return 0;
}

function findSiblingBlockEnd(lines: string[], fromIndex: number, indentLevel: number): number {
  for (let index = fromIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (line.trim().length === 0) {
      continue;
    }

    if (countIndentLevel(line) < indentLevel) {
      return index - 1;
    }
  }

  return lines.length - 1;
}

function describeLine(raw: string): { indentLevel: number; label: string } | null {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith(MINDMAP_DSL_ROOT_PREFIX.trim())) {
    return {
      indentLevel: countIndentLevel(raw),
      label: trimmed.slice(MINDMAP_DSL_ROOT_PREFIX.length).trim(),
    };
  }

  if (trimmed.startsWith(MINDMAP_DSL_BRANCH_PREFIX.trim())) {
    return {
      indentLevel: countIndentLevel(raw),
      label: trimmed.slice(MINDMAP_DSL_BRANCH_PREFIX.length).trim(),
    };
  }

  if (trimmed.startsWith(MINDMAP_DSL_LEAF_PREFIX)) {
    return {
      indentLevel: countIndentLevel(raw),
      label: trimmed.slice(MINDMAP_DSL_LEAF_PREFIX.length).trim(),
    };
  }

  return {
    indentLevel: countIndentLevel(raw),
    label: trimmed,
  };
}

function countIndentLevel(raw: string): number {
  const leadingSpaces = raw.match(/^ */)?.[0].length ?? 0;
  return Math.floor(leadingSpaces / MINDMAP_DSL_INDENT.length);
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .replace(/^[-@:\s]+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}