'use client';

import Editor from '@monaco-editor/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { CancellationToken, editor, languages } from 'monaco-editor';

import {
  isIgnorableMonacoCancellation,
} from '../lib/completion/monaco-cancellation';
import {
  createMindmapDslInlineCompletionsProvider,
} from '../lib/completion/monaco-inline-provider';
import {
  requestInlineCompletionFromApi,
  trackInlineCompletionEvent,
} from '../lib/completion/client';
import { createInlineSuggestionRange } from '../lib/dsl/inline-completion';
import {
  MINDMAP_DSL_INLINE_FORMAT_MARKERS,
  toggleMindmapDslInlineFormatting,
} from '../lib/dsl/inline-formatting';
import type { MindmapDslInlineFormat } from '../lib/dsl/inline-formatting';

// ── Module-level Monaco state ──────────────────────────────────────────────

let mindmapDslInlineCompletionRegistered = false;
const mindmapDslLanguageId = 'mindmap-dsl';
const enableMonacoInlineCompletions = true;

// The inline-completion provider is registered once globally, but the selected
// completion model lives in React state. This module-level holder bridges the
// two: the provider reads it lazily on each request, and the component keeps it
// in sync, so the latest selection is always used without re-registering.
let activeCompletionModelId: string | undefined;

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
  completionModelId?: string;
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

  monaco.languages.registerInlineCompletionsProvider(
    mindmapDslLanguageId,
    createMindmapDslInlineCompletionsProvider(
      monaco,
      requestInlineCompletionFromApi,
      trackInlineCompletionEvent,
      () => activeCompletionModelId,
    ),
  );

  mindmapDslInlineCompletionRegistered = true;
}

// ── Component ──────────────────────────────────────────────────────────────

const editorLoadingFallback = (
  <div className="flex h-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
    Loading Monaco editor…
  </div>
);

const DslEditorPanel = forwardRef<DslEditorPanelHandle, DslEditorPanelProps>(
  function DslEditorPanel({ defaultValue, onChange, onGenerateMindmap, onResetDsl, completionModelId }, ref) {
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

    // Keep the globally-registered inline-completion provider pointed at the
    // currently-selected completion model.
    useEffect(() => {
      activeCompletionModelId = completionModelId;
    }, [completionModelId]);

    function applyInlineFormat(format: MindmapDslInlineFormat): void {
      const monacoEditor = editorRef.current;
      const model = monacoEditor?.getModel();
      const selection = monacoEditor?.getSelection();
      if (!monacoEditor || !model || !selection) return;

      const selectedText = model.getValueInRange(selection);
      const text = toggleMindmapDslInlineFormatting(selectedText, format);

      monacoEditor.executeEdits('mindmap-inline-format', [
        { range: selection, text, forceMoveMarkers: true },
      ]);
      monacoEditor.pushUndoStop();

      // With no selection, park the caret between the inserted markers.
      if (selectedText.length === 0) {
        monacoEditor.setPosition({
          lineNumber: selection.startLineNumber,
          column: selection.startColumn + MINDMAP_DSL_INLINE_FORMAT_MARKERS[format].prefix.length,
        });
      }
      monacoEditor.focus();
    }

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

        {/* ── Formatting toolbar ───────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-0.5 border-b border-zinc-200 px-2 py-1">
          <button
            aria-label="Bold selection"
            className="rounded-md px-2 py-1 text-xs font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
            onClick={() => {
              applyInlineFormat('bold');
            }}
            title="Bold (**text**)"
            type="button"
          >
            B
          </button>
          <button
            aria-label="Italicize selection"
            className="rounded-md px-2 py-1 text-xs italic text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
            onClick={() => {
              applyInlineFormat('italic');
            }}
            title="Italic (_text_)"
            type="button"
          >
            I
          </button>
          <button
            aria-label="Underline selection"
            className="rounded-md px-2 py-1 text-xs text-zinc-500 underline transition hover:bg-zinc-100 hover:text-zinc-700"
            onClick={() => {
              applyInlineFormat('underline');
            }}
            title="Underline (<u>text</u>)"
            type="button"
          >
            U
          </button>
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
