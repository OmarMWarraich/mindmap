'use client';

export interface ScalingValues {
  nodeWidthScale: number;
  nodeHeightScale: number;
  nodePaddingScale: number;
  siblingGapScale: number;
  levelGapScale: number;
  fontScale: number;
}

export const defaultScalingValues: ScalingValues = {
  nodeWidthScale: 1.42,
  nodeHeightScale: 1.48,
  nodePaddingScale: 1.22,
  siblingGapScale: 1.18,
  levelGapScale: 1.1,
  fontScale: 1,
};

interface ExpertScalingPanelProps {
  values: ScalingValues;
  onChange: (key: keyof ScalingValues, value: number) => void;
  onReset: () => void;
}

const SLIDERS: ReadonlyArray<{
  key: keyof ScalingValues;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'nodeWidthScale',   label: 'Box width',       min: 1,    max: 2.2, step: 0.02 },
  { key: 'nodeHeightScale',  label: 'Box height',      min: 1,    max: 2.2, step: 0.02 },
  { key: 'nodePaddingScale', label: 'Box padding',     min: 1,    max: 2,   step: 0.02 },
  { key: 'siblingGapScale',  label: 'Sibling spacing', min: 0.85, max: 1.8, step: 0.01 },
  { key: 'levelGapScale',    label: 'Root distance',   min: 0.9,  max: 1.8, step: 0.01 },
  { key: 'fontScale',        label: 'Text size',       min: 0.9,  max: 2.5, step: 0.01 },
];

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ChevronUpDownIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  );
}

export default function ExpertScalingPanel({ values, onChange, onReset }: ExpertScalingPanelProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2.5">
        <div className="grid gap-0.5">
          <h2 className="text-sm font-semibold text-zinc-900">Expert Scaling</h2>
          <p className="text-xs text-zinc-500">Affects PNG export only</p>
        </div>
        <button
          aria-label="Collapse scaling panel"
          className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          type="button"
        >
          <ChevronUpDownIcon />
        </button>
      </div>

      {/* ── Slider rows ─────────────────────────────────────────── */}
      <div className="flex flex-col">
        {SLIDERS.map((slider, i) => (
          <div
            className={`flex items-center gap-3 px-4 py-2.5${i < SLIDERS.length - 1 ? ' border-b border-zinc-100' : ''}`}
            key={slider.key}
          >
            <span className="min-w-0 flex-1 text-sm text-zinc-700">{slider.label}</span>
            <input
              className="w-28 accent-zinc-700"
              max={slider.max}
              min={slider.min}
              onChange={(event) => {
                onChange(slider.key, Number(event.target.value));
              }}
              step={slider.step}
              type="range"
              value={values[slider.key]}
            />
            <span className="w-10 text-right text-xs font-medium tabular-nums text-zinc-500">
              {formatPct(values[slider.key])}
            </span>
          </div>
        ))}
      </div>

      {/* ── Footer: Reset button ─────────────────────────────────── */}
      <div className="flex shrink-0 justify-end border-t border-zinc-200 px-4 py-3">
        <button
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          onClick={onReset}
          type="button"
        >
          Reset Scaling
        </button>
      </div>
    </div>
  );
}
