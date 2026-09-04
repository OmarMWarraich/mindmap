'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import {
  buildSvgPreviewModel,
  clampSvgPreviewScale,
  createDefaultSvgPreviewTransform,
  getSvgPreviewRenderMetrics,
  panSvgPreviewTransform,
  type SvgPreviewTransform,
  zoomSvgPreviewAroundPoint,
} from '../lib/mindmap/svg-preview';
import type { MindmapLayoutResult } from '../lib/mindmap/layout';
import type { MindmapNodePositionOverrides } from '../lib/mindmap/node-overrides';
import type { GeneratedMindmap } from '../lib/mindmap/schema';
import type { MindmapTheme } from '../lib/mindmap/theme';
import { defaultMindmapTheme } from '../lib/mindmap/theme';

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
  nodePositionOverrides?: MindmapNodePositionOverrides;
  onNodePositionOverridesChange?: (overrides: MindmapNodePositionOverrides) => void;
  theme?: MindmapTheme;
}>(function MindmapSvgPreview({
  mindmap,
  layoutResult,
  layoutStatus,
  layoutError,
  transform: controlledTransform,
  onTransformChange,
  nodePositionOverrides,
  onNodePositionOverridesChange,
  theme = defaultMindmapTheme,
}, ref) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const nodeDragRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [uncontrolledTransform, setUncontrolledTransform] = useState(createDefaultSvgPreviewTransform);
  const transform = controlledTransform ?? uncontrolledTransform;
  const setTransform = onTransformChange ?? setUncontrolledTransform;
  const model = mindmap && layoutResult ? buildSvgPreviewModel(mindmap, layoutResult, { theme }) : null;
  const previewMetrics = getSvgPreviewRenderMetrics();

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
      <div className="grid min-h-[460px] place-items-center rounded-2xl border border-accent-200 bg-accent-50/60 p-6 text-center">
        <div className="grid max-w-sm gap-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-accent-700 shadow-sm">
            <span className="text-2xl">◌</span>
          </div>
          <h3 className="text-lg font-semibold text-accent-950">Computing layout</h3>
          <p className="text-sm leading-6 text-accent-900/80">
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
        <div className="absolute left-4 top-4 z-10 rounded-full border border-accent-200 bg-white/90 px-3 py-2 text-xs font-medium text-accent-900 shadow-sm backdrop-blur">
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
          nodeDragRef.current = null;
          setIsDragging(false);
          setDraggingNodeId(null);
        }}
        onPointerMove={(event) => {
          const rect = svgRef.current?.getBoundingClientRect();

          if (!rect) {
            return;
          }

          const nodeDrag = nodeDragRef.current;

          if (nodeDrag && onNodePositionOverridesChange) {
            // Screen px → viewBox units → layout user units (undo the zoom scale).
            const stepX = (((event.clientX - nodeDrag.x) / rect.width) * model.width) / transform.scale;
            const stepY = (((event.clientY - nodeDrag.y) / rect.height) * model.height) / transform.scale;
            const current = nodePositionOverrides?.[nodeDrag.nodeId] ?? { dx: 0, dy: 0 };

            nodeDragRef.current = { nodeId: nodeDrag.nodeId, x: event.clientX, y: event.clientY };
            onNodePositionOverridesChange({
              ...nodePositionOverrides,
              [nodeDrag.nodeId]: { dx: current.dx + stepX, dy: current.dy + stepY },
            });
            return;
          }

          const dragStart = dragStartRef.current;

          if (!dragStart) {
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
          nodeDragRef.current = null;
          setIsDragging(false);
          setDraggingNodeId(null);
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
          {theme.background.kind === 'gradient' ? (
            <linearGradient gradientTransform={`rotate(${theme.background.angle} 0.5 0.5)`} id="mindmap-theme-gradient">
              <stop offset="0%" stopColor={theme.background.from} />
              <stop offset="100%" stopColor={theme.background.to} />
            </linearGradient>
          ) : null}
        </defs>
        {theme.background.kind === 'image' ? (
          <>
            <image
              height={previewModel.height}
              href={theme.background.imageDataUrl}
              preserveAspectRatio="xMidYMid slice"
              width={previewModel.width}
              x="0"
              y="0"
            />
            <rect
              fill={theme.background.overlayColor}
              fillOpacity={theme.background.overlayOpacity}
              height={previewModel.height}
              width={previewModel.width}
              x="0"
              y="0"
            />
          </>
        ) : (
          <rect
            fill={
              theme.background.kind === 'solid'
                ? theme.background.color
                : theme.background.kind === 'gradient'
                  ? 'url(#mindmap-theme-gradient)'
                  : 'url(#mindmap-grid)'
            }
            height={previewModel.height}
            width={previewModel.width}
            x="0"
            y="0"
          />
        )}

        <g transform={`matrix(${transform.scale} 0 0 ${transform.scale} ${transform.translateX} ${transform.translateY})`}>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {previewModel.edges.map((edge) => (
              <path
                d={edge.path}
                key={edge.id}
                stroke={edge.color}
                strokeOpacity={theme.edge.opacity}
                strokeWidth={previewMetrics.edgeStrokeWidth * theme.edge.strokeWidthScale}
              />
            ))}
          </g>

          <g>
            {previewModel.nodes.map((node) => {
              return (
                <g
                  className={
                    onNodePositionOverridesChange
                      ? draggingNodeId === node.id
                        ? 'cursor-grabbing'
                        : 'cursor-move'
                      : undefined
                  }
                  key={node.id}
                  onPointerDown={
                    onNodePositionOverridesChange
                      ? (event) => {
                          event.stopPropagation();
                          nodeDragRef.current = { nodeId: node.id, x: event.clientX, y: event.clientY };
                          setDraggingNodeId(node.id);
                          svgRef.current?.setPointerCapture(event.pointerId);
                        }
                      : undefined
                  }
                  transform={`translate(${node.x} ${node.y})`}
                >
                  {theme.node.frostOpacity > 0 ? (
                    <rect
                      fill="#ffffff"
                      fillOpacity={theme.node.frostOpacity}
                      height={node.height}
                      rx={(node.kind === 'root' ? previewMetrics.rootCornerRadius : previewMetrics.nodeCornerRadius) * theme.node.cornerRadiusScale}
                      width={node.width}
                      x="0"
                      y="0"
                    />
                  ) : null}
                  <rect
                    fill={node.style.fill}
                    fillOpacity={theme.node.fillOpacity < 1 ? theme.node.fillOpacity : undefined}
                    height={node.height}
                    rx={(node.kind === 'root' ? previewMetrics.rootCornerRadius : previewMetrics.nodeCornerRadius) * theme.node.cornerRadiusScale}
                    stroke={node.style.stroke}
                    strokeWidth={(node.kind === 'root' ? previewMetrics.rootStrokeWidth : previewMetrics.nodeStrokeWidth) * theme.node.strokeWidthScale}
                    width={node.width}
                    x="0"
                    y="0"
                  />
                  <rect
                    fill={node.style.accent}
                    height={previewMetrics.accentHeight}
                    rx={previewMetrics.accentHeight / 2}
                    width={Math.max(previewMetrics.accentMinWidth, node.width * previewMetrics.accentWidthRatio)}
                    x={previewMetrics.accentInsetX}
                    y={previewMetrics.accentInsetY}
                  />
                  <text
                    dominantBaseline="hanging"
                    fill={node.style.text}
                    fontFamily={theme.typography.fontFamily}
                    fontSize={node.fontSize}
                    fontWeight={node.kind === 'root' ? 800 : 700}
                    textAnchor="middle"
                    x={node.width / 2}
                  >
                    {node.lineSegments.flatMap((segments, lineIndex) =>
                      segments.map((segment, segmentIndex) => (
                        <tspan
                          fontStyle={segment.italic ? 'italic' : undefined}
                          fontWeight={segment.bold ? 900 : undefined}
                          key={`${node.id}-${lineIndex}-${segmentIndex}`}
                          textDecoration={segment.underline ? 'underline' : undefined}
                          x={segmentIndex === 0 ? node.width / 2 : undefined}
                          y={segmentIndex === 0 ? node.lineStartY + lineIndex * node.lineHeight : undefined}
                        >
                          {segment.text}
                        </tspan>
                      )),
                    )}
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