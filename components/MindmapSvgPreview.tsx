'use client';

import { buildSvgPreviewModel } from '../lib/mindmap/svg-preview';
import type { MindmapLayoutResult } from '../lib/mindmap/layout';
import type { GeneratedMindmap } from '../lib/mindmap/schema';

export default function MindmapSvgPreview({
  mindmap,
  layoutResult,
}: {
  mindmap: GeneratedMindmap | null;
  layoutResult: MindmapLayoutResult | null;
}) {
  if (!mindmap || !layoutResult) {
    return (
      <div className="grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
        <div className="grid max-w-sm gap-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
            <span className="text-2xl">◎</span>
          </div>
          <h3 className="text-lg font-semibold text-zinc-950">Preview placeholder</h3>
          <p className="text-sm leading-6 text-zinc-600">
            The radial preview will appear here once the outline parses and the worker finishes layout.
          </p>
        </div>
      </div>
    );
  }

  const model = buildSvgPreviewModel(mindmap, layoutResult);

  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#fffef8_0%,_#ffffff_55%,_#f8fafc_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <svg
        aria-label="Rendered mindmap preview"
        className="h-[460px] w-full"
        role="img"
        viewBox={`0 0 ${Math.max(model.width, 1)} ${Math.max(model.height, 1)}`}
      >
        <defs>
          <pattern height="32" id="mindmap-grid" patternUnits="userSpaceOnUse" width="32">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect fill="url(#mindmap-grid)" height={model.height} width={model.width} x="0" y="0" />

        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {model.edges.map((edge) => (
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
          {model.nodes.map((node) => {
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
      </svg>
    </div>
  );
}