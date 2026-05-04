'use client';

import Editor from '@monaco-editor/react';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { CancellationToken, editor, languages } from 'monaco-editor';

import MindmapSvgPreview from './MindmapSvgPreview';
import type { MindmapSvgPreviewHandle } from './MindmapSvgPreview';
import {
  requestInlineCompletionFromApi,
  trackInlineCompletionEvent,
} from '../lib/completion/client';
import { getMindmapSectionContext } from '../lib/dsl/editor-context';
import {
  createInlineSuggestionRange,
  getStubInlineSuggestionSet,
  pickPreferredStubSuggestion,
} from '../lib/dsl/inline-completion';
import { generateMindmapFromAst } from '../lib/mindmap/from-ast';
import {
  createExportMindmapVariant,
  layoutMindmapWithElk,
  type MindmapExportScaleOptions,
  type MindmapLayoutResult,
} from '../lib/mindmap/layout';
import {
  createSvgPreviewSnapshot,
  createDefaultSvgPreviewTransform,
  type SvgPreviewTransform,
} from '../lib/mindmap/svg-preview';
import type { GeneratedMindmap } from '../lib/mindmap/schema';
import type { LayoutWorkerDiagnostics } from '../lib/mindmap/worker-diagnostics';
import { downloadNodeAsPng } from '../lib/export/png';
import {
  loadWorkspaceDraft,
  saveWorkspaceDraft,
} from '../lib/persistence/workspace';
import { parseMindmapDsl } from '../lib/dsl/parse';
import { mindmapDslStarterOutline } from '../lib/dsl/mvp';
import type { MindmapValidationIssue } from '../lib/dsl/validation';

let mindmapDslInlineCompletionRegistered = false;
const mindmapDslLanguageId = 'mindmap-dsl';
const enableMonacoInlineCompletions = true;
let mindmapDslInlineSuggestionPreference: InlineSuggestionPreference = 'auto';

type InlineSuggestionPreference = 'auto' | 'continuation' | 'enrichment';

interface ExportControlState {
  nodeWidthScale: number;
  nodeHeightScale: number;
  nodePaddingScale: number;
  siblingGapScale: number;
  levelGapScale: number;
  fontScale: number;
}

const defaultExportControlState: ExportControlState = {
  nodeWidthScale: 1.28,
  nodeHeightScale: 1.36,
  nodePaddingScale: 1.18,
  siblingGapScale: 1.14,
  levelGapScale: 1.08,
  fontScale: 1,
};

const editorLoadingFallback = (
  <div className="flex h-[460px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-sm text-zinc-500">
    Loading Monaco editor...
  </div>
);

function isIgnorableMonacoCancellation(reason: unknown): boolean {
  if (!(reason instanceof Error) || reason.message !== 'Canceled') {
    return false;
  }

  return typeof reason.stack === 'string' && reason.stack.includes('monaco-editor');
}

export default function StudyWorkspace() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const editorDisposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const previewRef = useRef<MindmapSvgPreviewHandle | null>(null);
  const hasRestoredDraftRef = useRef(false);
  const layoutRequestIdRef = useRef(0);
  const ghostTextDecorationIdsRef = useRef<string[]>([]);
  const ghostTextStateRef = useRef<{
    position: { lineNumber: number; column: number };
    suggestionText: string;
  } | null>(null);
  const [outline, setOutline] = useState(mindmapDslStarterOutline);
  const [debouncedOutline, setDebouncedOutline] = useState(mindmapDslStarterOutline);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [latestMindmapSnapshot, setLatestMindmapSnapshot] = useState<GeneratedMindmap | null>(null);
  const [latestMindmapSnapshotOutline, setLatestMindmapSnapshotOutline] = useState<string | null>(null);
  const [layoutResult, setLayoutResult] = useState<MindmapLayoutResult | null>(null);
  const [layoutStatus, setLayoutStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [previewTransform, setPreviewTransform] = useState<SvgPreviewTransform>(
    createDefaultSvgPreviewTransform,
  );
  const [exportStatus, setExportStatus] = useState<{
    tone: 'idle' | 'progress' | 'success' | 'error';
    message: string;
  }>({
    tone: 'idle',
    message: 'PNG export is ready once a preview is visible.',
  });
  const [draftStatus, setDraftStatus] = useState<{
    tone: 'idle' | 'progress' | 'success' | 'error';
    message: string;
  }>({
    tone: 'progress',
    message: 'Restoring local draft…',
  });
  const [layoutDiagnostics, setLayoutDiagnostics] = useState<LayoutWorkerDiagnostics>({
    phase: 'main-thread',
    summary: 'Using the in-page layout engine for beta preview rendering.',
  });
  const [inlineSuggestionPreference, setInlineSuggestionPreference] =
    useState<InlineSuggestionPreference>('auto');
  const [exportControls, setExportControls] = useState<ExportControlState>(defaultExportControlState);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setDebouncedOutline(outline);
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [outline]);

  const parseResult = useMemo(() => parseMindmapDsl(debouncedOutline), [debouncedOutline]);
  const sectionContext = useMemo(
    () => getMindmapSectionContext(outline, cursorPosition),
    [cursorPosition, outline],
  );
  const stubSuggestionSet = useMemo(
    () => getStubInlineSuggestionSet(sectionContext),
    [sectionContext],
  );
  const preferredStubSuggestion = useMemo(
    () => pickPreferredStubSuggestion(stubSuggestionSet, inlineSuggestionPreference),
    [inlineSuggestionPreference, stubSuggestionSet],
  );
  const isParsing = outline !== debouncedOutline;
  const generatedMindmap = useMemo(() => {
    if (!parseResult.ast) {
      return null;
    }

    return generateMindmapFromAst(parseResult.ast, {
      warnings: parseResult.warnings,
      errors: parseResult.errors,
    });
  }, [parseResult.ast, parseResult.errors, parseResult.warnings]);
  const effectiveMindmap = generatedMindmap
    ?? (latestMindmapSnapshotOutline === outline ? latestMindmapSnapshot : null);

  const effectiveLayoutStatus = layoutStatus;
  const effectiveLayoutError = layoutError;
  const effectiveLayoutDiagnostics = layoutDiagnostics;
  const branchCount = parseResult.ast?.root.branches.length ?? 0;
  const nodeCount = (parseResult.ast?.root.branches ?? []).reduce((count, branch) => {
    const countChildren = (children: typeof branch.children): number => {
      return children.reduce((total, child) => total + 1 + countChildren(child.children), 0);
    };

    return count + 1 + countChildren(branch.children);
  }, 1);

  useEffect(() => {
    mindmapDslInlineSuggestionPreference = inlineSuggestionPreference;
  }, [inlineSuggestionPreference]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isIgnorableMonacoCancellation(event.reason)) {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadWorkspaceDraft()
      .then((draft) => {
        if (cancelled) {
          return;
        }

        if (!draft) {
          setDraftStatus({
            tone: 'idle',
            message: 'Local draft storage is ready for this workspace.',
          });
          return;
        }

        setOutline(draft.outline);
        setDebouncedOutline(draft.outline);
        setLatestMindmapSnapshot(draft.mindmap);
        setLatestMindmapSnapshotOutline(draft.outline);
        setPreviewTransform(draft.previewTransform);
        setDraftStatus({
          tone: 'success',
          message: 'Restored the saved draft and preview state.',
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setDraftStatus({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Local draft restore failed.',
        });
      })
      .finally(() => {
        if (!cancelled) {
          hasRestoredDraftRef.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!generatedMindmap) {
      return;
    }

    setLatestMindmapSnapshot(generatedMindmap);
    setLatestMindmapSnapshotOutline(outline);
  }, [generatedMindmap, outline]);

  useEffect(() => {
    if (enableMonacoInlineCompletions) {
      const editor = editorRef.current;

      if (editor) {
        ghostTextDecorationIdsRef.current = editor.deltaDecorations(ghostTextDecorationIdsRef.current, []);
      }

      ghostTextStateRef.current = null;
      return;
    }

    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const ghostTextPreview = getGhostTextPreview(preferredStubSuggestion?.insertText ?? '');

    if (!ghostTextPreview) {
      ghostTextStateRef.current = null;
      ghostTextDecorationIdsRef.current = editor.deltaDecorations(ghostTextDecorationIdsRef.current, []);
      return;
    }

    const position = editor.getPosition() ?? cursorPosition;
    ghostTextStateRef.current = {
      position: {
        lineNumber: position.lineNumber,
        column: position.column,
      },
      suggestionText: preferredStubSuggestion?.insertText ?? '',
    };

    ghostTextDecorationIdsRef.current = editor.deltaDecorations(
      ghostTextDecorationIdsRef.current,
      [
        {
          range: createInlineSuggestionRange(position),
          options: {
            after: {
              content: ghostTextPreview,
              cursorStops: monacoInjectedTextCursorStops.none,
              inlineClassName: 'mindmap-editor-ghost-text',
              inlineClassNameAffectsLetterSpacing: true,
            },
            showIfCollapsed: true,
            stickiness: 1,
          },
        },
      ],
    );
  }, [cursorPosition, preferredStubSuggestion]);

  useEffect(() => {
    if (!effectiveMindmap) {
      setLayoutResult(null);
      setLayoutStatus('idle');
      setLayoutError(null);
      setLayoutDiagnostics({
        phase: 'idle',
        summary: 'Preview is idle until the outline parses into a valid AST.',
      });
      return;
    }

    const requestId = layoutRequestIdRef.current + 1;
    layoutRequestIdRef.current = requestId;
    const startedAt = performance.now();
    let cancelled = false;

    setLayoutStatus('loading');
    setLayoutError(null);

    setLayoutDiagnostics({
      phase: 'main-thread',
      summary: `Computing layout request ${requestId} in the page thread.`,
      detail: `Running ELK for ${effectiveMindmap.nodes.length} nodes and ${effectiveMindmap.edges.length} edges without the dedicated worker path.`,
      requestId,
    });

    void layoutMindmapWithElk(effectiveMindmap)
      .then((result) => {
        if (cancelled || layoutRequestIdRef.current !== requestId) {
          return;
        }

        const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
        setLayoutResult(result);
        setLayoutStatus('ready');
        setLayoutError(null);
        setLayoutDiagnostics({
          phase: 'ready',
          summary: `Layout completed in ${elapsedMs}ms on the page thread.`,
          detail: `Request ${requestId} returned ${result.nodes.length} nodes and ${result.edges.length} routed edges.`,
          requestId,
          elapsedMs,
        });
      })
      .catch((error) => {
        if (cancelled || layoutRequestIdRef.current !== requestId) {
          return;
        }

        const detail = error instanceof Error ? error.message : 'Unknown ELK layout failure.';
        setLayoutStatus('error');
        setLayoutError(detail);
        setLayoutDiagnostics({
          phase: 'response-error',
          summary: 'In-page layout computation failed.',
          detail,
          requestId,
          elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
        });
        console.error('mindmap layout failure', {
          phase: 'response-error',
          detail,
          requestId,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveMindmap]);

  useEffect(() => {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveWorkspaceDraft({
        version: 1,
        updatedAt: new Date().toISOString(),
        outline,
        mindmap: latestMindmapSnapshot,
        previewTransform,
      })
        .then((saved) => {
          if (!saved) {
            setDraftStatus({
              tone: 'error',
              message: 'Local draft storage is unavailable in this browser.',
            });
            return;
          }

          setDraftStatus({
            tone: 'success',
            message: 'Draft and preview state saved locally.',
          });
        })
        .catch((error) => {
          setDraftStatus({
            tone: 'error',
            message: error instanceof Error ? error.message : 'Local draft save failed.',
          });
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [latestMindmapSnapshot, outline, previewTransform]);

  useEffect(() => {
    return () => {
      editorDisposablesRef.current.forEach((disposable) => {
        disposable.dispose();
      });
      editorDisposablesRef.current = [];
    };
  }, []);

  async function handleDownloadPng(): Promise<void> {
    if (!effectiveMindmap) {
      setExportStatus({
        tone: 'error',
        message: 'PNG export is unavailable until the preview finishes rendering.',
      });
      return;
    }

    setExportStatus({
      tone: 'progress',
      message: 'Computing export layout…',
    });

    try {
      const exportMindmap = createExportMindmapVariant(
        effectiveMindmap,
        getExportScaleOptions(exportControls),
      );
      const exportLayout = await layoutMindmapWithElk(exportMindmap);
      const snapshot = createSvgPreviewSnapshot(exportMindmap, exportLayout, {
        profile: 'export',
        renderScale: exportControls.fontScale,
      });

      setExportStatus({
        tone: 'progress',
        message: 'Rendering PNG export…',
      });

      const dimensions = await downloadNodeAsPng(snapshot.node, {
        backgroundColor: '#fffef8',
        fileNameBase: effectiveMindmap?.metadata.title ?? parseResult.ast?.root.label ?? 'mindmap',
        sourceWidth: snapshot.width,
        sourceHeight: snapshot.height,
      });

      setExportStatus({
        tone: 'success',
        message: dimensions.wasClamped
          ? `Downloaded a scaled PNG at ${dimensions.outputWidth}x${dimensions.outputHeight} to keep large exports reliable.`
          : `Downloaded PNG at ${dimensions.outputWidth}x${dimensions.outputHeight}.`,
      });
    } catch (error) {
      setExportStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'PNG export failed unexpectedly.',
      });
    }
  }

  return (
    <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-zinc-950">Toolbar area</h2>
          <p className="text-sm leading-6 text-zinc-600">
            Generate, refresh, export, and status controls will live here.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700">
            {isParsing ? 'Parsing…' : `Parsed ${nodeCount} nodes`}
          </span>
          <button className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800">
            Generate mindmap
          </button>
          <button className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100">
            Refresh preview
          </button>
          <button
            className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!layoutResult || layoutStatus === 'loading'}
            onClick={() => {
              void handleDownloadPng();
            }}
            type="button"
          >
            Download PNG
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
          exportStatus.tone === 'success'
            ? 'bg-emerald-100 text-emerald-700'
            : exportStatus.tone === 'error'
              ? 'bg-rose-100 text-rose-700'
              : exportStatus.tone === 'progress'
                ? 'bg-sky-100 text-sky-700'
                : 'bg-zinc-100 text-zinc-700'
        }`}>
          Export
        </span>
        <span className="ml-3">{exportStatus.message}</span>
        <span className={`ml-4 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
          draftStatus.tone === 'success'
            ? 'bg-emerald-100 text-emerald-700'
            : draftStatus.tone === 'error'
              ? 'bg-rose-100 text-rose-700'
              : draftStatus.tone === 'progress'
                ? 'bg-sky-100 text-sky-700'
                : 'bg-zinc-100 text-zinc-700'
        }`}>
          Draft
        </span>
        <span className="ml-3">{draftStatus.message}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold text-zinc-950">Study editor</h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600">
              Monaco now hosts the study outline directly in the app shell so later
              parsing, completions, and preview updates can build on the real editor.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <p className="text-sm font-medium text-emerald-900">Starter outline loaded</p>
              <p className="text-sm leading-6 text-emerald-800/80">
                The editor opens with a working DSL example so users can learn the
                format from a concrete root, branch, and nested leaf structure.
              </p>
            </div>

            <button
              className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
              onClick={() => {
                editorRef.current?.setValue(mindmapDslStarterOutline);
                setOutline(mindmapDslStarterOutline);
              }}
              type="button"
            >
              Reset starter outline
            </button>
          </div>

          <div className="h-[460px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <Editor
              beforeMount={configureMindmapDslMonaco}
              defaultValue={mindmapDslStarterOutline}
              defaultLanguage={mindmapDslLanguageId}
              height="100%"
              loading={editorLoadingFallback}
              onChange={(value) => {
                setOutline(value ?? '');
              }}
              onMount={(editor, monaco) => {
                editorDisposablesRef.current.forEach((disposable) => {
                  disposable.dispose();
                });
                editorDisposablesRef.current = [];
                editorRef.current = editor;
                const position = editor.getPosition();

                if (position) {
                  setCursorPosition(position);
                }

                editorDisposablesRef.current.push(
                  editor.onDidChangeCursorPosition((event) => {
                    setCursorPosition(event.position);
                  }),
                );
                editorDisposablesRef.current.push(
                  editor.onDidChangeModelContent(() => {
                    const nextPosition = editor.getPosition();

                    if (nextPosition) {
                      setCursorPosition(nextPosition);
                    }
                  }),
                );
                editorDisposablesRef.current.push(
                  editor.onKeyDown((event) => {
                    if (enableMonacoInlineCompletions) {
                      return;
                    }

                    if (event.browserEvent.key !== 'Tab') {
                      return;
                    }

                    const ghostTextState = ghostTextStateRef.current;
                    const currentPosition = editor.getPosition();
                    const selection = editor.getSelection();

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
                    editor.executeEdits('mindmap-ghost-text', [
                      {
                        range: createInlineSuggestionRange(ghostTextState.position),
                        text: ghostTextState.suggestionText,
                        forceMoveMarkers: true,
                      },
                    ]);
                    editor.pushUndoStop();
                    ghostTextStateRef.current = null;
                    ghostTextDecorationIdsRef.current = editor.deltaDecorations(
                      ghostTextDecorationIdsRef.current,
                      [],
                    );
                    const nextPosition = editor.getPosition();
                    if (nextPosition) {
                      setCursorPosition(nextPosition);
                    }
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

          <div className="grid gap-4 lg:grid-cols-2">
            <ValidationPanel
              issues={parseResult.errors}
              tone="error"
              title={`Errors (${parseResult.errors.length})`}
            />
            <ValidationPanel
              issues={parseResult.warnings}
              tone="warning"
              title={`Warnings (${parseResult.warnings.length})`}
            />
          </div>
        </section>

        <aside className="grid gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold text-zinc-950">Mindmap preview</h2>
            <p className="text-sm leading-6 text-zinc-600">
              Layout output now renders as a radial SVG with branch-aware colour styling
              so the preview reflects the generated graph instead of a placeholder.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-1">
                <h3 className="text-sm font-semibold text-amber-950">Export scaling</h3>
                <p className="text-sm leading-6 text-amber-900/80">
                  These controls affect PNG export only. Increase box size, spacing, and text without changing the on-screen preview.
                </p>
              </div>
              <button
                className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                onClick={() => {
                  setExportControls(defaultExportControlState);
                }}
                type="button"
              >
                Reset export scaling
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2 rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-zinc-700">
                <span className="flex items-center justify-between font-medium text-zinc-900">
                  <span>Box width</span>
                  <span>{formatScaleLabel(exportControls.nodeWidthScale)}</span>
                </span>
                <input
                  max="2.2"
                  min="1"
                  onChange={(event) => {
                    updateExportControl('nodeWidthScale', Number(event.target.value));
                  }}
                  step="0.02"
                  type="range"
                  value={exportControls.nodeWidthScale}
                />
              </label>

              <label className="grid gap-2 rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-zinc-700">
                <span className="flex items-center justify-between font-medium text-zinc-900">
                  <span>Box height</span>
                  <span>{formatScaleLabel(exportControls.nodeHeightScale)}</span>
                </span>
                <input
                  max="2.2"
                  min="1"
                  onChange={(event) => {
                    updateExportControl('nodeHeightScale', Number(event.target.value));
                  }}
                  step="0.02"
                  type="range"
                  value={exportControls.nodeHeightScale}
                />
              </label>

              <label className="grid gap-2 rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-zinc-700">
                <span className="flex items-center justify-between font-medium text-zinc-900">
                  <span>Box padding</span>
                  <span>{formatScaleLabel(exportControls.nodePaddingScale)}</span>
                </span>
                <input
                  max="2"
                  min="1"
                  onChange={(event) => {
                    updateExportControl('nodePaddingScale', Number(event.target.value));
                  }}
                  step="0.02"
                  type="range"
                  value={exportControls.nodePaddingScale}
                />
              </label>

              <label className="grid gap-2 rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-zinc-700">
                <span className="flex items-center justify-between font-medium text-zinc-900">
                  <span>Sibling spacing</span>
                  <span>{formatScaleLabel(exportControls.siblingGapScale)}</span>
                </span>
                <input
                  max="1.8"
                  min="0.85"
                  onChange={(event) => {
                    updateExportControl('siblingGapScale', Number(event.target.value));
                  }}
                  step="0.01"
                  type="range"
                  value={exportControls.siblingGapScale}
                />
              </label>

              <label className="grid gap-2 rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-zinc-700">
                <span className="flex items-center justify-between font-medium text-zinc-900">
                  <span>Root distance</span>
                  <span>{formatScaleLabel(exportControls.levelGapScale)}</span>
                </span>
                <input
                  max="1.8"
                  min="0.9"
                  onChange={(event) => {
                    updateExportControl('levelGapScale', Number(event.target.value));
                  }}
                  step="0.01"
                  type="range"
                  value={exportControls.levelGapScale}
                />
              </label>

              <label className="grid gap-2 rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-zinc-700">
                <span className="flex items-center justify-between font-medium text-zinc-900">
                  <span>Text size</span>
                  <span>{formatScaleLabel(exportControls.fontScale)}</span>
                </span>
                <input
                  max="1.9"
                  min="0.9"
                  onChange={(event) => {
                    updateExportControl('fontScale', Number(event.target.value));
                  }}
                  step="0.01"
                  type="range"
                  value={exportControls.fontScale}
                />
              </label>
            </div>
          </div>

          <MindmapSvgPreview
            ref={previewRef}
            layoutError={effectiveLayoutError}
            layoutResult={layoutResult}
            layoutStatus={effectiveLayoutStatus}
            mindmap={effectiveMindmap}
            onTransformChange={setPreviewTransform}
            transform={previewTransform}
          />
        </aside>
      </div>
    </section>
  );

  function updateExportControl<Key extends keyof ExportControlState>(
    key: Key,
    value: ExportControlState[Key],
  ): void {
    setExportControls((current) => ({
      ...current,
      [key]: value,
    }));
  }
}

function getExportScaleOptions(controls: ExportControlState): MindmapExportScaleOptions {
  return {
    nodeWidthScale: controls.nodeWidthScale,
    nodeHeightScale: controls.nodeHeightScale,
    nodePaddingScale: controls.nodePaddingScale,
    siblingGapScale: controls.siblingGapScale,
    levelGapScale: controls.levelGapScale,
  };
}

function formatScaleLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ValidationPanel({
  issues,
  title,
  tone,
}: {
  issues: MindmapValidationIssue[];
  title: string;
  tone: 'error' | 'warning';
}) {
  const palette = tone === 'error'
    ? {
        badge: 'bg-rose-100 text-rose-700',
        border: 'border-rose-200',
        subtle: 'text-rose-900',
      }
    : {
        badge: 'bg-amber-100 text-amber-700',
        border: 'border-amber-200',
        subtle: 'text-amber-900',
      };

  return (
    <section className={`grid gap-3 rounded-2xl border bg-white p-4 ${palette.border}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${palette.badge}`}>
          {issues.length === 0 ? 'clear' : 'active'}
        </span>
      </div>

      {issues.length === 0 ? (
        <p className="text-sm leading-6 text-zinc-500">
          {tone === 'error'
            ? 'No blocking parser errors in the current outline.'
            : 'No parser warnings in the current outline.'}
        </p>
      ) : (
        <ul className="grid gap-2">
          {issues.map((issue, index) => (
            <li
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
              key={`${issue.code}-${issue.target.source?.line ?? 'unknown'}-${index}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                <span>{issue.code}</span>
                <span className={palette.subtle}>
                  {formatIssueLocation(issue)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{issue.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatIssueLocation(issue: MindmapValidationIssue): string {
  const line = issue.target.source?.line;
  const column = issue.target.source?.column;

  if (line == null) {
    return 'document-level';
  }

  return column == null ? `line ${line}` : `line ${line}, col ${column}`;
}

const monacoInjectedTextCursorStops = {
  none: 3,
} as const;

function getGhostTextPreview(insertText: string): string {
  if (!insertText) {
    return '';
  }

  return insertText
    .replace(/\r?\n/g, '  ↵  ')
    .replace(/\s+/g, ' ')
    .trim();
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

function configureMindmapDslMonaco(monaco: Monaco): void {
  if (
    !monaco.languages
      .getLanguages()
      .some((language: languages.ILanguageExtensionPoint) => language.id === mindmapDslLanguageId)
  ) {
    monaco.languages.register({ id: mindmapDslLanguageId });
  }

  if (mindmapDslInlineCompletionRegistered) {
    return;
  }

  if (!enableMonacoInlineCompletions) {
    return;
  }

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
            cursor: {
              lineNumber: position.lineNumber,
              column: position.column,
            },
          },
          {
            signal: abortController.signal,
          },
        );

        if (
          token.isCancellationRequested
          || model.isDisposed()
          || model.getVersionId() !== requestVersionId
          || !response
          || response.completionText.length === 0
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
      _completions: languages.InlineCompletions,
      item: languages.InlineCompletion,
      reason: languages.InlineCompletionEndOfLifeReason,
      lifetimeSummary: languages.LifetimeSummary,
    ) {
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
    disposeInlineCompletions() {},
    displayName: 'Mindmap study assistant',
  });

  mindmapDslInlineCompletionRegistered = true;
}
