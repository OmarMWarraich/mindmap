'use client';

import Editor from '@monaco-editor/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { CancellationToken, editor, languages } from 'monaco-editor';

import {
  requestInlineCompletionFromApi,
  trackInlineCompletionEvent,
} from '../lib/completion/client';
import { createInlineSuggestionRange } from '../lib/dsl/inline-completion';

// ── Module-level Monaco state ──────────────────────────────────────────────

let mindmapDslInlineCompletionRegistered = false;
const mindmapDslLanguageId = 'mindmap-dsl';
const enableMonacoInlineCompletions = true;

// ── Public types ───────────────────────────────────────────────────────────

export interface DslEditorPanelHandle {
  setValue(value: string): void;
  getValue(): string;
  focus(): void;
  setPosition(pos: { lineNumber: number; column: number }): void;
}

interface DslEditorPanelProps {
  defaultValue: string;
  onChange: (value: string) => void;
  onGenerateMindmap: () => void;
  onResetDsl: () => void;
}

// ── Icons ─────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ── Monaco helpers ─────────────────────────────────────────────────────────

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
    dispose() {
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

function isIgnorableMonacoCancellation(reason: unknown): boolean {
  if (!(reason instanceof Error) || reason.message !== 'Canceled') {
    return false;
  }
  return typeof reason.stack === 'string' && reason.stack.includes('monaco-editor');
}

function configureMindmapDslMonaco(monaco: Monaco): void {
  if (
    !monaco.languages
      .getLanguages()
      .some((language: languages.ILanguageExtensionPoint) => language.id === mindmapDslLanguageId)
  ) {
    monaco.languages.register({ id: mindmapDslLanguageId });
  }

  if (mindmapDslInlineCompletionRegistered) return;
  if (!enableMonacoInlineCompletions) return;

  monaco.languages.registerInlineCompletionsProvider(mindmapDslLanguageId, {
    async provideInlineCompletions(
      model: editor.ITextModel,
      position: { lineNumber: number; column: number },
      _context: languages.InlineCompletionContext,
      token: CancellationToken,
    ) {
      if (token.isCancellationRequested || model.isDisposed()) {
        return { items: [] };
      }

      const requestVersionId = model.getVersionId();
      const { abortController, dispose } = linkAbortControllerToCancellationToken(token);

      try {
        const correlationId = createInlineCompletionCorrelationId();
        const response = await requestInlineCompletionFromApi(
          {
            outline: model.getValue(),
            cursor: { lineNumber: position.lineNumber, column: position.column },
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
        if (isAbortError(error)) return { items: [] };
        return { items: [] };
      } finally {
        dispose();
      }
    },
    handleEndOfLifetime(
      _completions: languages.InlineCompletions,
      item: languages.InlineCompletion,
      reason: languages.InlineCompletionEndOfLifeReason,
      lifetimeSummary: languages.LifetimeSummary,
    ) {
      if (!item.correlationId || typeof item.insertText !== 'string') return;
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
  });

  mindmapDslInlineCompletionRegistered = true;
}

// ── Component ──────────────────────────────────────────────────────────────

const editorLoadingFallback = (
  <div className="flex h-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
    Loading Monaco editor…
  </div>
);

const DslEditorPanel = forwardRef<DslEditorPanelHandle, DslEditorPanelProps>(
  function DslEditorPanel({ defaultValue, onChange, onGenerateMindmap, onResetDsl }, ref) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const editorDisposablesRef = useRef<Array<{ dispose(): void }>>([]);
    const ghostTextDecorationIdsRef = useRef<string[]>([]);
    const ghostTextStateRef = useRef<{
      position: { lineNumber: number; column: number };
      suggestionText: string;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      setValue(value) {
        editorRef.current?.setValue(value);
      },
      getValue() {
        return editorRef.current?.getValue() ?? '';
      },
      focus() {
        editorRef.current?.focus();
      },
      setPosition(pos) {
        editorRef.current?.setPosition(pos);
      },
    }));

    // Suppress Monaco cancellation noise in development
    useEffect(() => {
      if (process.env.NODE_ENV !== 'development') return;

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        if (!isIgnorableMonacoCancellation(event.reason)) return;
        event.preventDefault();
      };

      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }, []);

    // Editor cleanup
    useEffect(() => {
      return () => {
        editorDisposablesRef.current.forEach((d) => d.dispose());
        editorDisposablesRef.current = [];
      };
    }, []);

    return (
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-zinc-900">DSL Editor</h2>
          <div className="flex items-center gap-0.5">
            <button
              aria-label="Edit DSL"
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
              type="button"
            >
              <PencilIcon />
            </button>
            <button
              aria-label="Fullscreen"
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
              type="button"
            >
              <MaximizeIcon />
            </button>
            <button
              aria-label="Copy DSL"
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
              type="button"
            >
              <CopyIcon />
            </button>
          </div>
        </div>

        {/* ── Monaco editor ────────────────────────────────────────── */}
        <div className="min-h-0 flex-1">
          <Editor
            beforeMount={configureMindmapDslMonaco}
            defaultValue={defaultValue}
            defaultLanguage={mindmapDslLanguageId}
            height="100%"
            loading={editorLoadingFallback}
            onChange={(value) => {
              onChange(value ?? '');
            }}
            onMount={(monacoEditor, monaco) => {
              editorDisposablesRef.current.forEach((d) => d.dispose());
              editorDisposablesRef.current = [];
              editorRef.current = monacoEditor;

              editorDisposablesRef.current.push(
                monacoEditor.onKeyDown((event) => {
                  if (enableMonacoInlineCompletions) return;
                  if (event.browserEvent.key !== 'Tab') return;

                  const ghostTextState = ghostTextStateRef.current;
                  const currentPosition = monacoEditor.getPosition();
                  const selection = monacoEditor.getSelection();

                  if (!ghostTextState || !currentPosition || !selection || !selection.isEmpty()) {
                    return;
                  }

                  if (
                    currentPosition.lineNumber !== ghostTextState.position.lineNumber ||
                    currentPosition.column !== ghostTextState.position.column
                  ) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  monacoEditor.executeEdits('mindmap-ghost-text', [
                    {
                      range: createInlineSuggestionRange(ghostTextState.position),
                      text: ghostTextState.suggestionText,
                      forceMoveMarkers: true,
                    },
                  ]);
                  monacoEditor.pushUndoStop();
                  ghostTextStateRef.current = null;
                  ghostTextDecorationIdsRef.current = monacoEditor.deltaDecorations(
                    ghostTextDecorationIdsRef.current,
                    [],
                  );
                }),
              );

              monaco.editor.remeasureFonts();
            }}
            options={{
              automaticLayout: true,
              glyphMargin: false,
              inlineSuggest: { enabled: enableMonacoInlineCompletions },
              minimap: { enabled: false },
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
            path="mindmap://study-outline.dsl"
            theme="light"
          />
        </div>

        {/* ── Action buttons ───────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            className="rounded-lg bg-primary-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
            onClick={onGenerateMindmap}
            type="button"
          >
            Generate mindmap
          </button>
          <button
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
            onClick={onResetDsl}
            type="button"
          >
            Reset DSL
          </button>
        </div>
      </div>
    );
  },
);

DslEditorPanel.displayName = 'DslEditorPanel';
export default DslEditorPanel;
