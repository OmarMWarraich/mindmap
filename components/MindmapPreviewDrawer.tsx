'use client';

import { forwardRef } from 'react';

import MindmapSvgPreview from './MindmapSvgPreview';
import type { MindmapSvgPreviewHandle } from './MindmapSvgPreview';
import type { MindmapLayoutResult } from '../lib/mindmap/layout';
import type { GeneratedMindmap } from '../lib/mindmap/schema';
import type { SvgPreviewTransform } from '../lib/mindmap/svg-preview';
import type { MindmapTheme } from '../lib/mindmap/theme';

export interface MindmapPreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  mindmap: GeneratedMindmap | null;
  layoutResult: MindmapLayoutResult | null;
  layoutStatus: 'idle' | 'loading' | 'ready' | 'error';
  layoutError: string | null;
  transform: SvgPreviewTransform;
  onTransformChange: (transform: SvgPreviewTransform) => void;
  theme?: MindmapTheme;
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

const MindmapPreviewDrawer = forwardRef<
  MindmapSvgPreviewHandle,
  MindmapPreviewDrawerProps
>(function MindmapPreviewDrawer(
  {
    open,
    onClose,
    mindmap,
    layoutResult,
    layoutStatus,
    layoutError,
    transform,
    onTransformChange,
    theme,
  },
  ref,
) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Mindmap preview">
      {/* ── Backdrop ──────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="flex-1 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* ── Drawer panel ──────────────────────────────────────────── */}
      <div className="flex w-[min(680px,100vw)] shrink-0 flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-3.5">
          <div className="grid gap-0.5">
            <h2 className="text-sm font-semibold text-zinc-900">Mindmap Preview</h2>
            <p className="text-xs text-zinc-500">Drag to pan · scroll to zoom</p>
          </div>
          <button
            aria-label="Close preview"
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            onClick={onClose}
            type="button"
          >
            <XIcon />
          </button>
        </div>

        {/* Preview body */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <MindmapSvgPreview
            ref={ref}
            layoutError={layoutError}
            layoutResult={layoutResult}
            layoutStatus={layoutStatus}
            mindmap={mindmap}
            onTransformChange={onTransformChange}
            theme={theme}
            transform={transform}
          />
        </div>
      </div>
    </div>
  );
});

export default MindmapPreviewDrawer;
