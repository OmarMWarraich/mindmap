import type { MindmapSectionContext } from './editor-context.ts';
import { MINDMAP_DSL_INDENT } from './mvp.ts';

export interface StubInlineSuggestion {
  explanation: string;
  insertText: string;
  kind: 'continuation' | 'enrichment';
}

export interface StubInlineSuggestionSet {
  continuation: StubInlineSuggestion | null;
  enrichment: StubInlineSuggestion | null;
}

export function getStubInlineSuggestionSet(
  context: MindmapSectionContext,
): StubInlineSuggestionSet {
  return {
    continuation: getContinuationSuggestion(context),
    enrichment: getEnrichmentSuggestion(context),
  };
}

export function pickPreferredStubSuggestion(
  suggestions: StubInlineSuggestionSet,
  preference: 'auto' | 'continuation' | 'enrichment' = 'auto',
): StubInlineSuggestion | null {
  if (preference === 'continuation') {
    return suggestions.continuation;
  }

  if (preference === 'enrichment') {
    return suggestions.enrichment;
  }

  return suggestions.continuation ?? suggestions.enrichment;
}

export function createInlineSuggestionRange(
  position: { lineNumber: number; column: number },
): {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
} {
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: position.column,
    endColumn: position.column,
  };
}

function getContinuationSuggestion(
  context: MindmapSectionContext,
): StubInlineSuggestion | null {
  const trimmedPrefix = context.currentLinePrefix.trimStart();

  if (trimmedPrefix.length === 0 && context.rootLabel == null && context.cursor.lineNumber === 1) {
    return {
      kind: 'continuation',
      insertText: '@root: Topic',
      explanation: 'Start the outline with a valid root declaration.',
    };
  }

  if (trimmedPrefix.startsWith('@') && !trimmedPrefix.startsWith('@root:')) {
    return buildTemplateContinuation(trimmedPrefix, '@root: Topic', 'Complete the root marker.');
  }

  if (trimmedPrefix.startsWith('- @') && !trimmedPrefix.startsWith('- @branch:')) {
    return buildTemplateContinuation(
      trimmedPrefix,
      '- @branch: Key idea',
      'Complete the branch marker.',
    );
  }

  if (trimmedPrefix === '- ') {
    return {
      kind: 'continuation',
      insertText: 'Key detail',
      explanation: 'Finish the leaf label on the current line.',
    };
  }

  if (context.currentLineKind === 'branch' && context.currentLabelFragment.length > 0) {
    return {
      kind: 'continuation',
      insertText: ' overview',
      explanation: 'Extend the current branch label.',
    };
  }

  if (context.currentLineKind === 'leaf' && context.currentLabelFragment.length > 0) {
    return {
      kind: 'continuation',
      insertText: ' detail',
      explanation: 'Extend the current leaf label.',
    };
  }

  return null;
}

function getEnrichmentSuggestion(
  context: MindmapSectionContext,
): StubInlineSuggestion | null {
  const trimmedPrefix = context.currentLinePrefix.trim();
  const isAtLineEnd = context.currentLinePrefix.length === context.currentLine.length;

  if (trimmedPrefix.length === 0) {
    if (context.rootLabel == null) {
      return null;
    }

    if (context.indentLevel === 0) {
      return {
        kind: 'enrichment',
        insertText: '- @branch: Key idea',
        explanation: 'Add the next top-level branch for the current topic.',
      };
    }

    return {
      kind: 'enrichment',
      insertText: '- Supporting detail',
      explanation: 'Add the next detail within the active section.',
    };
  }

  if (context.currentLineKind === 'root') {
    if (!isAtLineEnd) {
      return null;
    }

    return {
      kind: 'enrichment',
      insertText: '\n- @branch: Key idea',
      explanation: 'Add the first branch beneath the root topic.',
    };
  }

  if (context.currentLineKind === 'branch') {
    if (!isAtLineEnd) {
      return null;
    }

    return {
      kind: 'enrichment',
      insertText: `\n${MINDMAP_DSL_INDENT}- Key detail`,
      explanation: 'Add a study detail inside the current branch.',
    };
  }

  if (context.currentLineKind === 'leaf') {
    if (!isAtLineEnd) {
      return null;
    }

    return {
      kind: 'enrichment',
      insertText: `\n${MINDMAP_DSL_INDENT.repeat(context.indentLevel + 1)}- Supporting fact`,
      explanation: 'Add a child detail under the current sub-branch.',
    };
  }

  return null;
}

function buildTemplateContinuation(
  trimmedPrefix: string,
  template: string,
  explanation: string,
): StubInlineSuggestion {
  const normalizedPrefix = trimmedPrefix.toLowerCase();
  const normalizedTemplate = template.toLowerCase();
  const insertText = normalizedTemplate.startsWith(normalizedPrefix)
    ? template.slice(trimmedPrefix.length)
    : template;

  return {
    kind: 'continuation',
    insertText,
    explanation,
  };
}