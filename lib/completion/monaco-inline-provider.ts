import type { Monaco } from '@monaco-editor/react';
import type { CancellationToken, editor, languages } from 'monaco-editor';

import { createInlineSuggestionRange } from '../dsl/inline-completion.ts';

export interface InlineCompletionApiResponse {
  completionText: string;
  source: 'model';
}

export interface InlineCompletionEventPayload {
  correlationId: string;
  outcome: 'accepted' | 'dismissed' | 'ignored';
  outlineLength: number;
  requestReason: string;
  shownDurationMs: number;
  source: 'model';
  suggestionText: string;
}

export type RequestInlineCompletion = (
  request: {
    outline: string;
    cursor: { lineNumber: number; column: number };
    modelId?: string;
  },
  options: { signal: AbortSignal },
) => Promise<InlineCompletionApiResponse | null>;

export type TrackInlineCompletionEvent = (
  event: InlineCompletionEventPayload,
) => Promise<void>;

export interface MindmapInlineCompletion extends languages.InlineCompletion {
  correlationId?: string;
}

export interface MindmapInlineCompletions extends languages.InlineCompletions<
  MindmapInlineCompletion
> {
  items: MindmapInlineCompletion[];
}

export function createMindmapDslInlineCompletionsProvider(
  monaco: Monaco,
  requestInlineCompletion: RequestInlineCompletion,
  trackInlineCompletionEvent: TrackInlineCompletionEvent,
  getModelId?: () => string | undefined,
): languages.InlineCompletionsProvider<MindmapInlineCompletions> {
  return {
    async provideInlineCompletions(
      model: editor.ITextModel,
      position: { lineNumber: number; column: number },
      _context: languages.InlineCompletionContext,
      token: CancellationToken,
    ): Promise<MindmapInlineCompletions> {
      if (token.isCancellationRequested || model.isDisposed()) {
        return { items: [] };
      }

      const requestVersionId = model.getVersionId();
      const { abortController, dispose } = linkAbortControllerToCancellationToken(token);

      try {
        const correlationId = createInlineCompletionCorrelationId();
        const modelId = getModelId?.();
        const response = await requestInlineCompletion(
          {
            outline: model.getValue(),
            cursor: { lineNumber: position.lineNumber, column: position.column },
            ...(modelId ? { modelId } : {}),
          },
          { signal: abortController.signal },
        );

        if (
          token.isCancellationRequested ||
          model.isDisposed() ||
          model.getVersionId() !== requestVersionId ||
          !response ||
          response.completionText.length === 0
        ) {
          return { items: [] };
        }

        return {
          items: [
            {
              correlationId,
              insertText: response.completionText,
              range: createInlineSuggestionRange(position),
            },
          ],
        };
      } catch (error) {
        if (isAbortError(error)) {
          return { items: [] };
        }

        return { items: [] };
      } finally {
        dispose();
      }
    },
    handleEndOfLifetime(
      _completions: MindmapInlineCompletions,
      item: MindmapInlineCompletion,
      reason: languages.InlineCompletionEndOfLifeReason<MindmapInlineCompletion>,
      lifetimeSummary: languages.LifetimeSummary,
    ): void {
      if (!item.correlationId || typeof item.insertText !== 'string') {
        return;
      }

      void trackInlineCompletionEvent({
        correlationId: item.correlationId,
        outcome: mapInlineCompletionOutcome(monaco, reason.kind),
        outlineLength: lifetimeSummary.characterCountOriginal ?? 0,
        requestReason: lifetimeSummary.requestReason,
        shownDurationMs: lifetimeSummary.shownDuration,
        source: 'model',
        suggestionText: item.insertText,
      }).catch(() => undefined);
    },
    disposeInlineCompletions(): void {
      // Monaco 0.55 still requires this method even when handleEndOfLifetime is implemented.
    },
  };
}

function linkAbortControllerToCancellationToken(token: CancellationToken): {
  abortController: AbortController;
  dispose(): void;
} {
  const abortController = new AbortController();
  const listener = token.onCancellationRequested(() => {
    abortController.abort();
  });

  return {
    abortController,
    dispose(): void {
      listener.dispose();
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createInlineCompletionCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `completion-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapInlineCompletionOutcome(
  monaco: Monaco,
  reasonKind: languages.InlineCompletionEndOfLifeReasonKind,
): 'accepted' | 'dismissed' | 'ignored' {
  if (reasonKind === monaco.languages.InlineCompletionEndOfLifeReasonKind.Accepted) {
    return 'accepted';
  }

  if (reasonKind === monaco.languages.InlineCompletionEndOfLifeReasonKind.Rejected) {
    return 'dismissed';
  }

  return 'ignored';
}