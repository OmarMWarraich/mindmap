'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

import ChatPanel from './ChatPanel';
import DslEditorPanel from './DslEditorPanel';
import type { DslEditorPanelHandle } from './DslEditorPanel';
import ExpertScalingPanel from './ExpertScalingPanel';
import type { ScalingValues } from './ExpertScalingPanel';
import { defaultScalingValues } from './ExpertScalingPanel';
import GenerationHistoryPanel from './GenerationHistoryPanel';
import type { HistoryEntry } from './GenerationHistoryPanel';
import MindmapPreviewDrawer from './MindmapPreviewDrawer';
import MindmapSvgPreview from './MindmapSvgPreview';
import ModelSelector from './ModelSelector';
import SourceNotesPanel from './SourceNotesPanel';
import type { SourceGenerationDetailLevel } from './SourceNotesPanel';
import ThemePanel from './ThemePanel';
import { useWorkspace } from './WorkspaceContext';
import type { MindmapSvgPreviewHandle } from './MindmapSvgPreview';
import { requestMindmapDslGenerationFromApi } from '../lib/generation/client';
import type { SourceMindmapGenerationResponse } from '../lib/generation/source-schema';
import { loadModelChoices, saveModelChoices } from '../lib/model/model-choice-storage';
import { generateMindmapFromAst } from '../lib/mindmap/from-ast';
import {
  createExportMindmapVariant,
  type MindmapExportScaleOptions,
  type MindmapLayoutResult,
} from '../lib/mindmap/layout';
import { getMindmapLayoutClient } from '../lib/mindmap/layout-client';
import {
  applyMindmapNodePositionOverrides,
  pruneMindmapNodePositionOverrides,
  type MindmapNodePositionOverrides,
} from '../lib/mindmap/node-overrides';
import {
  createSvgPreviewSnapshot,
  createDefaultSvgPreviewTransform,
  type SvgPreviewTransform,
} from '../lib/mindmap/svg-preview';
import type { GeneratedMindmap } from '../lib/mindmap/schema';
import type { LayoutWorkerDiagnostics } from '../lib/mindmap/worker-diagnostics';
import { downloadNodeAsPng } from '../lib/export/png';
import {
  getOrCreateActiveProject,
  loadCloudDraft,
  loadWorkspaceDraft,
  recordGenerationHistory,
  saveCloudDraft,
  saveWorkspaceDraft,
} from '../lib/persistence/workspace';
import { parseMindmapDsl } from '../lib/dsl/parse';
import { mindmapDslStarterOutline } from '../lib/dsl/mvp';
import type { MindmapTheme } from '../lib/mindmap/theme';
import { defaultMindmapTheme } from '../lib/mindmap/theme';
import type { MindmapValidationIssue } from '../lib/dsl/validation';
import type { PublicModel } from '../lib/model/public-catalog';

interface StudyWorkspaceProps {
  userId: string;
}

export default function StudyWorkspace({ userId: _userId }: StudyWorkspaceProps) {
  const dslEditorRef = useRef<DslEditorPanelHandle | null>(null);
  const previewRef = useRef<MindmapSvgPreviewHandle | null>(null);
  const hasRestoredDraftRef = useRef(false);
  const layoutRequestIdRef = useRef(0);
  const [outline, setOutline] = useState(mindmapDslStarterOutline);
  const [debouncedOutline, setDebouncedOutline] = useState(mindmapDslStarterOutline);
  const [rawNotes, setRawNotes] = useState('');
  const [latestMindmapSnapshot, setLatestMindmapSnapshot] = useState<GeneratedMindmap | null>(null);
  const [latestMindmapSnapshotOutline, setLatestMindmapSnapshotOutline] = useState<string | null>(null);
  const [layoutResult, setLayoutResult] = useState<MindmapLayoutResult | null>(null);
  const [layoutStatus, setLayoutStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [previewTransform, setPreviewTransform] = useState<SvgPreviewTransform>(
    createDefaultSvgPreviewTransform,
  );
  const [nodePositionOverrides, setNodePositionOverrides] = useState<MindmapNodePositionOverrides>({});
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
  const [generationStatus, setGenerationStatus] = useState<{
    tone: 'idle' | 'progress' | 'success' | 'error';
    message: string;
  }>({
    tone: 'idle',
    message: 'Paste raw notes, then generate parser-ready DSL into the editor.',
  });
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<SourceGenerationDetailLevel>('standard');
  const [latestDslGeneration, setLatestDslGeneration] = useState<SourceMindmapGenerationResponse | null>(null);
  const [layoutDiagnostics, setLayoutDiagnostics] = useState<LayoutWorkerDiagnostics>({
    phase: 'idle',
    summary: 'Preview is idle until the outline parses into a valid AST.',
  });
  const [exportControls, setExportControls] = useState<ScalingValues>(defaultScalingValues);
  const [theme, setTheme] = useState<MindmapTheme>(defaultMindmapTheme);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [models, setModels] = useState<PublicModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [completionModelId, setCompletionModelId] = useState<string | undefined>(undefined);
  const [generationModelId, setGenerationModelId] = useState<string | undefined>(undefined);
  const { activePanel, setActivePanel, setProjectName, previewOpen, setPreviewOpen } = useWorkspace();

  // Fetch history when the user switches to the history panel.
  useEffect(() => {
    if (activePanel !== 'history' || !projectId) return;

    const controller = new AbortController();

    void (async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/history`, {
          signal: controller.signal,
        });
        if (res.ok) {
          setHistoryEntries((await res.json()) as HistoryEntry[]);
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    })();

    return () => controller.abort();
  }, [activePanel, projectId]);

  // Fetch the offerable model catalog once so the selectors can render.
  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch('/api/models', { signal: controller.signal });
        if (!res.ok) return;
        const payload = (await res.json()) as { models?: PublicModel[] };
        if (!controller.signal.aborted) {
          setModels(payload.models ?? []);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load model catalog.', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setModelsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, []);

  const completionModels = useMemo(
    () => models.filter((model) => model.roles.includes('completion')),
    [models],
  );
  const generationModels = useMemo(
    () => models.filter((model) => model.roles.includes('generation')),
    [models],
  );

  // Restore the user's persisted model choices once on mount (client-only).
  // localStorage can only be read after hydration, so this is a mount effect;
  // the reads are wrapped in a closure to keep the seeding off the synchronous
  // effect body (which would otherwise cascade-render).
  const modelChoicesRestoredRef = useRef(false);
  useEffect(() => {
    void (async () => {
      const stored = loadModelChoices();
      setCompletionModelId(stored.completionModelId);
      setGenerationModelId(stored.generationModelId);
      modelChoicesRestoredRef.current = true;
    })();
  }, []);

  // Drop a restored choice that the server no longer offers for its role (e.g.
  // the provider key was removed) so we fall back to the per-role default. Done
  // during render (guarded) instead of in an effect to avoid a cascading render;
  // each branch clears the stale id, which makes its own condition false on the
  // next render, so this cannot loop.
  if (!modelsLoading && models.length > 0) {
    if (completionModelId && !completionModels.some((m) => m.id === completionModelId)) {
      setCompletionModelId(undefined);
    }
    if (generationModelId && !generationModels.some((m) => m.id === generationModelId)) {
      setGenerationModelId(undefined);
    }
  }

  // Persist choices after the initial restore so reloads keep the selection.
  useEffect(() => {
    if (!modelChoicesRestoredRef.current) return;
    saveModelChoices({ completionModelId, generationModelId });
  }, [completionModelId, generationModelId]);

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
  const generatedMindmap = useMemo(() => {
    if (!parseResult.ast) {
      return null;
    }

    return generateMindmapFromAst(parseResult.ast, {
      warnings: parseResult.warnings,
      errors: parseResult.errors,
    });
  }, [parseResult.ast, parseResult.errors, parseResult.warnings]);

  // Sticky "last good" snapshot: retain the most recent non-null mindmap so the
  // preview survives transient outlines that fail to parse. Updated during render
  // (guarded) instead of in an effect to avoid a cascading render; the guard
  // matches the previous effect's deps (re-store whenever the mindmap or outline
  // changes) and becomes false once both are in sync, so this cannot loop.
  if (
    generatedMindmap
    && (latestMindmapSnapshot !== generatedMindmap || latestMindmapSnapshotOutline !== outline)
  ) {
    setLatestMindmapSnapshot(generatedMindmap);
    setLatestMindmapSnapshotOutline(outline);
  }

  const effectiveMindmap = generatedMindmap
    ?? (latestMindmapSnapshotOutline === outline ? latestMindmapSnapshot : null);

  const displayLayoutResult = useMemo(() => {
    if (!layoutResult || !effectiveMindmap) {
      return layoutResult;
    }

    return applyMindmapNodePositionOverrides(effectiveMindmap, layoutResult, nodePositionOverrides);
  }, [effectiveMindmap, layoutResult, nodePositionOverrides]);

  const effectiveLayoutStatus = layoutStatus;
  const effectiveLayoutError = layoutError;
  const effectiveLayoutDiagnostics = layoutDiagnostics;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // 1. Get or create the user's active project
        const project = await getOrCreateActiveProject();

        if (cancelled) return;
        setProjectId(project.id);
        setProjectName(project.name);

        // 2. Try cloud draft first
        const cloudDraft = await loadCloudDraft(project.id);

        if (cancelled) return;

        if (cloudDraft) {
          setOutline(cloudDraft.outline);
          setDebouncedOutline(cloudDraft.outline);
          setRawNotes(cloudDraft.rawNotes ?? '');
          setSelectedDetailLevel(cloudDraft.selectedDetailLevel ?? 'standard');
          setLatestDslGeneration(cloudDraft.latestDslGeneration ?? null);
          setLatestMindmapSnapshot(cloudDraft.mindmap);
          setLatestMindmapSnapshotOutline(cloudDraft.outline);
          setPreviewTransform(cloudDraft.previewTransform);
          setNodePositionOverrides(cloudDraft.nodePositionOverrides ?? {});
          setTheme(cloudDraft.theme ?? defaultMindmapTheme);
          setDraftStatus({
            tone: 'success',
            message: 'Restored saved project from the cloud.',
          });
          hasRestoredDraftRef.current = true;
          return;
        }

        // 3. Fall back to IndexedDB local draft
        const localDraft = await loadWorkspaceDraft();

        if (cancelled) return;

        if (localDraft) {
          setOutline(localDraft.outline);
          setDebouncedOutline(localDraft.outline);
          setRawNotes(localDraft.rawNotes ?? '');
          setSelectedDetailLevel(localDraft.selectedDetailLevel ?? 'standard');
          setLatestDslGeneration(localDraft.latestDslGeneration ?? null);
          setLatestMindmapSnapshot(localDraft.mindmap);
          setLatestMindmapSnapshotOutline(localDraft.outline);
          setPreviewTransform(localDraft.previewTransform);
          setNodePositionOverrides(localDraft.nodePositionOverrides ?? {});
          setTheme(localDraft.theme ?? defaultMindmapTheme);
          setDraftStatus({
            tone: 'success',
            message: 'Restored the saved draft and preview state.',
          });
          // Migrate local draft to cloud
          void saveCloudDraft(project.id, localDraft);
        } else {
          setDraftStatus({
            tone: 'idle',
            message: 'Project ready. Paste notes to begin.',
          });
        }
      } catch (error) {
        if (cancelled) return;
        setDraftStatus({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load project.',
        });
      } finally {
        if (!cancelled) {
          hasRestoredDraftRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!effectiveMindmap) {
      // Reset to idle when there's no valid mindmap to lay out. Kept in the
      // effect (not during render) so render stays pure; the state writes run in
      // a closure to avoid a synchronous cascade-render in the effect body, and
      // still apply immediately when the mindmap becomes unavailable.
      void (async () => {
        setLayoutResult(null);
        setLayoutStatus('idle');
        setLayoutError(null);
        setLayoutDiagnostics({
          phase: 'idle',
          summary: 'Preview is idle until the outline parses into a valid AST.',
        });
      })();
      return;
    }

    const requestId = layoutRequestIdRef.current + 1;
    layoutRequestIdRef.current = requestId;
    const startedAt = performance.now();
    let cancelled = false;

    void (async () => {
      setLayoutStatus('loading');
      setLayoutError(null);
      setLayoutDiagnostics({
        phase: 'posting',
        summary: `Starting layout request ${requestId} (attempting worker transport).`,
        detail: `Laying out ${effectiveMindmap.nodes.length} nodes and ${effectiveMindmap.edges.length} edges (worker preferred; main-thread fallback if unavailable).`,
        requestId,
      });

      try {
        const { result, transport, fallbackReason } =
          await getMindmapLayoutClient().layout(effectiveMindmap);
        if (cancelled || layoutRequestIdRef.current !== requestId) {
          return;
        }

        const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
        setLayoutResult(result);
        setLayoutStatus('ready');
        setLayoutError(null);
        setLayoutDiagnostics(
          transport === 'worker'
            ? {
                phase: 'ready',
                summary: `Layout worker completed request ${requestId} in ${elapsedMs}ms.`,
                detail: `Returned ${result.nodes.length} nodes and ${result.edges.length} routed edges.`,
                requestId,
                elapsedMs,
              }
            : {
                phase: 'main-thread',
                summary: `Layout completed in ${elapsedMs}ms on the main thread (worker unavailable).`,
                detail: fallbackReason ?? 'The layout worker was unavailable; used the in-page engine.',
                requestId,
                elapsedMs,
              },
        );
      } catch (error) {
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveMindmap]);

  useEffect(() => {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const draft = {
        version: 1 as const,
        updatedAt: new Date().toISOString(),
        outline,
        rawNotes,
        selectedDetailLevel,
        latestDslGeneration,
        mindmap: latestMindmapSnapshot,
        previewTransform,
        nodePositionOverrides: pruneMindmapNodePositionOverrides(
          nodePositionOverrides,
          latestMindmapSnapshot,
        ),
        theme,
      };

      void saveWorkspaceDraft(draft)
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
            message: 'Draft and preview state saved.',
          });
        })
        .catch((error) => {
          setDraftStatus({
            tone: 'error',
            message: error instanceof Error ? error.message : 'Local draft save failed.',
          });
        });

      if (projectId) {
        void saveCloudDraft(projectId, draft);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [latestDslGeneration, latestMindmapSnapshot, nodePositionOverrides, outline, previewTransform, projectId, rawNotes, selectedDetailLevel, theme]);

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
      // Off the main thread via the layout client (falls back to in-page ELK if
      // the worker is unavailable), so the upscaled export layout cannot jank the UI.
      const { result: exportLayout } = await getMindmapLayoutClient().layout(exportMindmap);
      // Drag offsets are stored in preview-layout units; rescale them into the
      // export layout's coordinate space so the PNG matches the preview.
      const exportLayoutWithOverrides = layoutResult
        ? applyMindmapNodePositionOverrides(exportMindmap, exportLayout, nodePositionOverrides, {
            scaleX: layoutResult.width > 0 ? exportLayout.width / layoutResult.width : 1,
            scaleY: layoutResult.height > 0 ? exportLayout.height / layoutResult.height : 1,
          })
        : exportLayout;
      const snapshot = createSvgPreviewSnapshot(exportMindmap, exportLayoutWithOverrides, {
        profile: 'export',
        renderScale: exportControls.fontScale,
        theme,
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

  function handleRestoreFromHistory(entry: HistoryEntry): void {
    dslEditorRef.current?.setValue(entry.dsl);
    dslEditorRef.current?.focus();
    dslEditorRef.current?.setPosition({ lineNumber: 1, column: 1 });
    setOutline(entry.dsl);
    setDebouncedOutline(entry.dsl);
    if (entry.rawNotes) {
      setRawNotes(entry.rawNotes);
    }
    setActivePanel('notes');
  }

  async function handleGenerateDsl(detailLevel: SourceGenerationDetailLevel = selectedDetailLevel): Promise<void> {
    const sourceText = rawNotes.trim();

    if (sourceText.length === 0) {
      setGenerationStatus({
        tone: 'error',
        message: 'Add some raw notes before generating DSL.',
      });
      return;
    }

    setSelectedDetailLevel(detailLevel);

    setGenerationStatus({
      tone: 'progress',
      message: 'Generating DSL from your notes…',
    });

    try {
      const readabilityMode = detailLevel === 'plain'
        ? 'plain'
        : detailLevel === 'compact'
          ? 'compact'
          : detailLevel === 'detailed'
            ? 'detailed'
            : 'compact';
      const response = await requestMindmapDslGenerationFromApi({
        sourceText,
        detailLevel,
        readabilityMode,
        modelId: generationModelId,
      });

      dslEditorRef.current?.setValue(response.dsl);
      dslEditorRef.current?.focus();
      dslEditorRef.current?.setPosition({ lineNumber: 1, column: 1 });
      setOutline(response.dsl);
      setDebouncedOutline(response.dsl);
      setLatestDslGeneration(response);

      if (projectId) {
        void recordGenerationHistory(projectId, {
          detailLevel,
          dsl: response.dsl,
          densityStatus: response.quality.densityStatus,
          nodeCount: response.metrics.generatedMeaningfulLineCount,
          rawNotes: sourceText,
        });
      }
      setGenerationStatus({
        tone: 'success',
        message: response.quality.densityStatus === 'target-met'
          ? `Generated ${response.metrics.generatedMeaningfulLineCount} DSL lines from ${response.metrics.sourceMeaningfulLineCount} source lines.`
          : response.quality.densityStatus === 'below-target'
            ? `Generated DSL is ready, but landed below the target expansion band (${response.metrics.generatedMeaningfulLineCount} lines).`
            : `Generated DSL is ready and denser than the target expansion band (${response.metrics.generatedMeaningfulLineCount} lines).`,
      });
    } catch (error) {
      setLatestDslGeneration(null);
      setGenerationStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'DSL generation failed unexpectedly.',
      });
    }
  }

  function handleGenerateMindmapFromDsl(): void {
    const currentOutline = dslEditorRef.current?.getValue() ?? outline;

    setOutline(currentOutline);
    setDebouncedOutline(currentOutline);
  }

  function persistDraftSnapshot(nextOutline: string, nextRawNotes: string): void {
    const draft = {
      version: 1 as const,
      updatedAt: new Date().toISOString(),
      outline: nextOutline,
      rawNotes: nextRawNotes,
      selectedDetailLevel,
      latestDslGeneration,
      mindmap: latestMindmapSnapshot,
      previewTransform,
      nodePositionOverrides: pruneMindmapNodePositionOverrides(
        nodePositionOverrides,
        latestMindmapSnapshot,
      ),
      theme,
    };

    void saveWorkspaceDraft(draft).catch((error) => {
      setDraftStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Local draft save failed.',
      });
    });

    if (projectId) {
      void saveCloudDraft(projectId, draft);
    }
  }

  function handleResetDsl(): void {
    const nextOutline = mindmapDslStarterOutline;
    dslEditorRef.current?.setValue(nextOutline);
    setOutline(nextOutline);
    setDebouncedOutline(nextOutline);
    persistDraftSnapshot(nextOutline, rawNotes);
  }

  function handleClearNotes(): void {
    const nextRawNotes = '';
    setRawNotes(nextRawNotes);
    setLatestDslGeneration(null);
    setGenerationStatus({
      tone: 'idle',
      message: 'Paste raw notes, then generate parser-ready DSL into the editor.',
    });
    persistDraftSnapshot(outline, nextRawNotes);
  }

  return (
    <div className="grid gap-6 p-5 xl:grid-cols-2">
        {/* Left column: DSL Editor + Validation */}
        <div className="flex flex-col gap-4">
          <ModelSelector
            id="completion-model"
            label="Completion model"
            loading={modelsLoading}
            models={completionModels}
            onChange={setCompletionModelId}
            placeholder="Default completion model"
            value={completionModelId}
          />
          {/* 480px below xl (the editor's pre-swap height); fills the column on xl like the notes slot it replaced. */}
          <div className="h-[480px] xl:flex-1">
            <DslEditorPanel
              ref={dslEditorRef}
              completionModelId={completionModelId}
              defaultValue={mindmapDslStarterOutline}
              value={outline}
              onChange={setOutline}
              onGenerateMindmap={handleGenerateMindmapFromDsl}
              onResetDsl={handleResetDsl}
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
        </div>

        {/* Right column: Source Notes (or History/Chat) + Preview/Export */}
        <div className="flex flex-col gap-4">
          {activePanel === 'history' ? (
            <GenerationHistoryPanel
              entries={historyEntries}
              loading={historyLoading}
              onBack={() => {
                setActivePanel('notes');
              }}
              onRestore={handleRestoreFromHistory}
            />
          ) : activePanel === 'chat' ? (
            <ChatPanel />
          ) : (
            <>
              <ModelSelector
                id="generation-model"
                label="Generation model"
                loading={modelsLoading}
                models={generationModels}
                onChange={setGenerationModelId}
                placeholder="Default generation model"
                value={generationModelId}
              />
              {/* Fixed height carried over from the editor slot this panel replaced. */}
              <div className="h-[480px]">
                <SourceNotesPanel
                  generationStatus={generationStatus}
                  latestDslGeneration={latestDslGeneration}
                  onClearNotes={handleClearNotes}
                  onDetailLevelChange={setSelectedDetailLevel}
                  onGenerateDsl={(detailLevel) => {
                    void handleGenerateDsl(detailLevel);
                  }}
                  onRawNotesChange={setRawNotes}
                  rawNotes={rawNotes}
                  selectedDetailLevel={selectedDetailLevel}
                />
              </div>
            </>
          )}

          <MindmapSvgPreview
            ref={previewRef}
            layoutError={effectiveLayoutError}
            layoutResult={displayLayoutResult}
            layoutStatus={effectiveLayoutStatus}
            mindmap={effectiveMindmap}
            nodePositionOverrides={nodePositionOverrides}
            onNodePositionOverridesChange={setNodePositionOverrides}
            onTransformChange={setPreviewTransform}
            theme={theme}
            transform={previewTransform}
          />

          <ThemePanel onThemeChange={setTheme} theme={theme} />

          <ExpertScalingPanel
            values={exportControls}
            onChange={(key, value) => {
              setExportControls((current) => ({ ...current, [key]: value }));
            }}
            onReset={() => {
              setExportControls(defaultScalingValues);
            }}
          />

          <MindmapPreviewDrawer
            ref={previewRef}
            layoutError={effectiveLayoutError}
            layoutResult={displayLayoutResult}
            layoutStatus={effectiveLayoutStatus}
            mindmap={effectiveMindmap}
            onClose={() => {
              setPreviewOpen(false);
            }}
            onTransformChange={setPreviewTransform}
            open={previewOpen}
            theme={theme}
            transform={previewTransform}
          />

          {/* Bottom action row */}
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            {/* <button
              className="flex-1 rounded-lg bg-accent-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-500"
              onClick={() => {
                void handleGenerateDsl();
              }}
              type="button"
            >
              Generate DSL
            </button>
            <button
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              onClick={handleClearNotes}
              type="button"
            >
              Clear
            </button> */}
            <button
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!layoutResult || layoutStatus === 'loading'}
              onClick={() => {
                void handleDownloadPng();
              }}
              type="button"
            >
              Quick Export
            </button>
          </div>
        </div>
    </div>
  );

}

function getExportScaleOptions(controls: ScalingValues): MindmapExportScaleOptions {
  return {
    nodeWidthScale: controls.nodeWidthScale,
    nodeHeightScale: controls.nodeHeightScale,
    nodePaddingScale: controls.nodePaddingScale,
    siblingGapScale: controls.siblingGapScale,
    levelGapScale: controls.levelGapScale,
    textScale: controls.fontScale,
  };
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
