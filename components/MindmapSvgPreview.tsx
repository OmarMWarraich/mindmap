'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import {
  buildSvgPreviewModel,
  clampSvgPreviewScale,
  createDefaultSvgPreviewTransform,
  panSvgPreviewTransform,
  type SvgPreviewTransform,
  zoomSvgPreviewAroundPoint,
} from '../lib/mindmap/svg-preview';
import type { MindmapLayoutResult } from '../lib/mindmap/layout';
import type { GeneratedMindmap } from '../lib/mindmap/schema';

export interface MindmapSvgPreviewHandle {
  getExportSnapshot(): {
    node: SVGSVGElement;
    width: number;
    height: number;
  } | null;
}

const MindmapSvgPreview = forwardRef<MindmapSvgPreviewHandle, {
  mindmap: GeneratedMindmap | null;
  layoutResult: MindmapLayoutResult | null;
  layoutStatus: 'idle' | 'loading' | 'ready' | 'error';
  layoutError: string | null;
  transform?: SvgPreviewTransform;
  onTransformChange?: (transform: SvgPreviewTransform) => void;
}>(function MindmapSvgPreview({
  mindmap,
  layoutResult,
  layoutStatus,
  layoutError,
  transform: controlledTransform,
  onTransformChange,
}, ref) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uncontrolledTransform, setUncontrolledTransform] = useState(createDefaultSvgPreviewTransform);
  const transform = controlledTransform ?? uncontrolledTransform;
  const setTransform = onTransformChange ?? setUncontrolledTransform;
  const model = mindmap && layoutResult ? buildSvgPreviewModel(mindmap, layoutResult) : null;

  useImperativeHandle(ref, () => ({
    getExportSnapshot() {
      if (!svgRef.current || !model) {
        return null;
      }

      return {
        node: svgRef.current,
        width: Math.max(1, Math.ceil(model.width)),
        height: Math.max(1, Math.ceil(model.height)),
      };
    },
  }), [model]);

  if (!mindmap || (!layoutResult && layoutStatus !== 'error' && layoutStatus !== 'loading')) {
    return (
      <div className="grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
        <div className="grid max-w-sm gap-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
            <span className="text-2xl">◎</span>
          </div>
          <h3 className="text-lg font-semibold text-zinc-950">Preview placeholder</h3>
          <p className="text-sm leading-6 text-zinc-600">
            The radial preview will appear here once the outline parses and layout finishes.
          </p>
        </div>
      </div>
    );
  }

  if (!layoutResult && layoutStatus === 'loading') {
    return (
      <div className="grid min-h-[460px] place-items-center rounded-2xl border border-sky-200 bg-sky-50/60 p-6 text-center">
        <div className="grid max-w-sm gap-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
            <span className="text-2xl">◌</span>
          </div>
          <h3 className="text-lg font-semibold text-sky-950">Computing layout</h3>
          <p className="text-sm leading-6 text-sky-900/80">
            The preview is translating the latest outline into radial positions and routed edges.
          </p>
        </div>
      </div>
    );
  }

  if (!layoutResult && layoutStatus === 'error') {
    return (
      <div className="grid min-h-[460px] place-items-center rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center">
        <div className="grid max-w-sm gap-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm">
            <span className="text-2xl">!</span>
          </div>
          <h3 className="text-lg font-semibold text-rose-950">Layout failed</h3>
          <p className="text-sm leading-6 text-rose-900/80">
            {layoutError ?? 'The preview could not compute a layout for the current outline.'}
          </p>
        </div>
      </div>
    );
  }

  if (!layoutResult) {
    return null;
  }

  if (!model) {
    return null;
  }

  const previewModel = model;

  function getSvgPoint(event: { clientX: number; clientY: number }) {
    const rect = svgRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    return {
      x: ((event.clientX - rect.left) / rect.width) * previewModel.width,
      y: ((event.clientY - rect.top) / rect.height) * previewModel.height,
    };
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#fffef8_0%,_#ffffff_55%,_#f8fafc_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      {layoutStatus === 'loading' ? (
        <div className="absolute left-4 top-4 z-10 rounded-full border border-sky-200 bg-white/90 px-3 py-2 text-xs font-medium text-sky-900 shadow-sm backdrop-blur">
          Updating layout...
        </div>
      ) : null}
      {layoutStatus === 'error' ? (
        <div className="absolute left-4 top-4 z-10 max-w-xs rounded-2xl border border-rose-200 bg-white/95 px-3 py-2 text-xs font-medium text-rose-900 shadow-sm backdrop-blur">
          {layoutError ?? 'Layout failed.'}
        </div>
      ) : null}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur">
        <span>{Math.round(transform.scale * 100)}%</span>
        <button
          className="rounded-full border border-zinc-200 px-3 py-1 transition hover:bg-zinc-100"
          onClick={() => {
            setTransform(createDefaultSvgPreviewTransform());
          }}
          type="button"
        >
          Reset view
        </button>
      </div>
      <svg
        aria-label="Rendered mindmap preview"
        className={`h-[460px] w-full touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={(event) => {
          dragStartRef.current = { x: event.clientX, y: event.clientY };
          setIsDragging(true);
          svgRef.current?.setPointerCapture(event.pointerId);
        }}
        onPointerLeave={() => {
          dragStartRef.current = null;
          setIsDragging(false);
        }}
        onPointerMove={(event) => {
          const dragStart = dragStartRef.current;

          if (!dragStart) {
            return;
          }

          const rect = svgRef.current?.getBoundingClientRect();

          if (!rect) {
            return;
          }

          const nextPoint = { x: event.clientX, y: event.clientY };
          const delta = {
            x: ((nextPoint.x - dragStart.x) / rect.width) * model.width,
            y: ((nextPoint.y - dragStart.y) / rect.height) * model.height,
          };

          dragStartRef.current = nextPoint;
          setTransform(panSvgPreviewTransform(transform, delta));
        }}
        onPointerUp={(event) => {
          dragStartRef.current = null;
          setIsDragging(false);
          svgRef.current?.releasePointerCapture(event.pointerId);
        }}
        onWheel={(event) => {
          event.preventDefault();
          const anchor = getSvgPoint(event);

          if (!anchor) {
            return;
          }

          const nextScale = clampSvgPreviewScale(
            transform.scale * (event.deltaY > 0 ? 0.92 : 1.08),
          );

          setTransform(zoomSvgPreviewAroundPoint(transform, nextScale, anchor));
        }}
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${Math.max(previewModel.width, 1)} ${Math.max(previewModel.height, 1)}`}
      >
        <defs>
          <pattern height="32" id="mindmap-grid" patternUnits="userSpaceOnUse" width="32">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect fill="url(#mindmap-grid)" height={previewModel.height} width={previewModel.width} x="0" y="0" />

        <g transform={`matrix(${transform.scale} 0 0 ${transform.scale} ${transform.translateX} ${transform.translateY})`}>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {previewModel.edges.map((edge) => (
              <path
                d={edge.path}
                key={edge.id}
                stroke={edge.color}
                strokeOpacity="0.72"
                strokeWidth="4"
              />
            ))}
          </g>

          <g>
            {previewModel.nodes.map((node) => {
              const lineStartY = node.kind === 'root' ? 50 : 42;

              return (
                <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  <rect
                    fill={node.style.fill}
                    height={node.height}
                    rx={node.kind === 'root' ? 28 : 24}
                    stroke={node.style.stroke}
                    strokeWidth={node.kind === 'root' ? 3 : 2}
                    width={node.width}
                    x="0"
                    y="0"
                  />
                  <rect
                    fill={node.style.accent}
                    height="6"
                    rx="3"
                    width={Math.max(44, node.width * 0.28)}
                    x="18"
                    y="16"
                  />
                  <text
                    fill={node.style.text}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontSize={node.kind === 'root' ? 22 : 16}
                    fontWeight={node.kind === 'root' ? 700 : 600}
                    x={node.width / 2}
                  >
                    {node.lines.map((line, index) => (
                      <tspan
                        dominantBaseline="hanging"
                        key={`${node.id}-${index}`}
                        textAnchor="middle"
                        x={node.width / 2}
                        y={lineStartY + index * 20}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
});

export default MindmapSvgPreview;