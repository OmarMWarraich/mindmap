'use client';

import { useRef, useState } from 'react';

import type { SourceMindmapGenerationResponse } from '../lib/generation/source-schema';
import { acceptedIngestionExtensions, ingestFiles } from '../lib/ingestion';

const fileInputAccept = acceptedIngestionExtensions.map((extension) => `.${extension}`).join(',');

// ── Types ─────────────────────────────────────────────────────────────────

export type SourceGenerationDetailLevel = 'standard' | 'detailed';

type StatusTone = 'idle' | 'progress' | 'success' | 'error';

export interface SourceNotesPanelProps {
  rawNotes: string;
  onRawNotesChange: (value: string) => void;
  selectedDetailLevel: SourceGenerationDetailLevel;
  onDetailLevelChange: (level: SourceGenerationDetailLevel) => void;
  generationStatus: { tone: StatusTone; message: string };
  latestDslGeneration: SourceMindmapGenerationResponse | null;
  onGenerateDsl: (detailLevel?: SourceGenerationDetailLevel) => void;
  onClearNotes: () => void;
}

// ── Icons ─────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" x2="20" y1="8" y2="14" />
      <line x1="23" x2="17" y1="11" y2="11" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function statusBadgeClass(tone: StatusTone): string {
  if (tone === 'success') return 'bg-tertiary-100 text-tertiary-700';
  if (tone === 'error') return 'bg-accent2-100 text-accent2-700';
  if (tone === 'progress') return 'bg-accent-100 text-accent-800';
  return 'bg-zinc-100 text-zinc-600';
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SourceNotesPanel({
  rawNotes,
  onRawNotesChange,
  selectedDetailLevel,
  onDetailLevelChange,
  generationStatus,
  latestDslGeneration,
  onGenerateDsl,
  onClearNotes,
}: SourceNotesPanelProps) {
  const isGenerating = generationStatus.tone === 'progress';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Always reflects the latest rawNotes prop value so the async append uses the
  // most recent textarea content (avoids stale-closure bugs after await).
  const rawNotesRef = useRef(rawNotes);
  rawNotesRef.current = rawNotes;
  const [isReading, setIsReading] = useState(false);
  const [attachStatus, setAttachStatus] = useState<{ tone: StatusTone; message: string } | null>(null);

  async function handleFilesSelected(files: File[]): Promise<void> {
    if (files.length === 0) {
      return;
    }

    setIsReading(true);
    setAttachStatus({ tone: 'progress', message: 'Reading file…' });
    const result = await ingestFiles(files);
    setIsReading(false);

    // Append (never overwrite) so an attachment adds to whatever is already there.
    // Read from ref so we always append to the latest textarea content, even if the
    // user typed while the file was being read.
    if (result.text) {
      const current = rawNotesRef.current;
      const separator = current.trim().length > 0 ? '\n\n' : '';
      onRawNotesChange(current + separator + result.text);
    }

    if (result.ingested.length > 0 && result.errors.length === 0) {
      const names = result.ingested.map((item) => item.meta.fileName).join(', ');
      setAttachStatus({ tone: 'success', message: `Loaded ${names}.` });
    } else if (result.ingested.length > 0) {
      setAttachStatus({
        tone: 'error',
        message: `Loaded ${result.ingested.length} file(s); skipped others — ${result.errors
          .map((error) => error.message)
          .join(' ')}`,
      });
    } else {
      setAttachStatus({
        tone: 'error',
        message: result.errors.map((error) => error.message).join(' ') || 'No file could be read.',
      });
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Source Notes</h2>
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Search notes"
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            type="button"
          >
            <SearchIcon />
          </button>
          <button
            aria-label="Share notes"
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            type="button"
          >
            <UserPlusIcon />
          </button>
        </div>
      </div>

      {/* ── Detail-level toggle ────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-100 px-4 py-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Detail
        </span>
        <button
          aria-pressed={selectedDetailLevel === 'standard'}
          className={[
            'rounded-full px-3 py-1 text-xs font-medium transition',
            selectedDetailLevel === 'standard'
              ? 'bg-accent-600 text-white'
              : 'text-zinc-600 hover:bg-zinc-100',
          ].join(' ')}
          disabled={isGenerating}
          onClick={() => {
            onDetailLevelChange('standard');
          }}
          type="button"
        >
          Standard
        </button>
        <button
          aria-pressed={selectedDetailLevel === 'detailed'}
          className={[
            'rounded-full px-3 py-1 text-xs font-medium transition',
            selectedDetailLevel === 'detailed'
              ? 'bg-accent-600 text-white'
              : 'text-zinc-600 hover:bg-zinc-100',
          ].join(' ')}
          disabled={isGenerating}
          onClick={() => {
            onDetailLevelChange('detailed');
          }}
          type="button"
        >
          Detailed
        </button>
      </div>

      {/* ── Textarea ──────────────────────────────────────────────── */}
      <textarea
        className="min-h-0 flex-1 resize-none px-4 py-3 text-sm leading-6 text-zinc-800 outline-none placeholder:text-zinc-400"
        onChange={(event) => {
          onRawNotesChange(event.target.value);
        }}
        placeholder="Paste notes, textbook bullets, video subtitles, or a transcript — the AI organizes it into a structured mindmap…"
        value={rawNotes}
      />

      {/* ── Quality badges footer ──────────────────────────────────── */}
      {latestDslGeneration ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              latestDslGeneration.quality.mode === 'retry'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-tertiary-100 text-tertiary-700'
            }`}
          >
            {latestDslGeneration.quality.mode === 'retry' ? 'retry pass' : 'first pass'}
          </span>
          {latestDslGeneration.quality.mode === 'retry' ? (
            <span
              aria-label="First DSL result was too sparse; model was asked for a denser revision."
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 bg-white text-[10px] font-semibold text-amber-800"
              role="img"
              title="First DSL result was too sparse; model was asked for a denser revision."
            >
              i
            </span>
          ) : null}
          {latestDslGeneration.metrics.generationMode === 'distill' ? (
            <span
              className="rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-medium text-accent-800"
              title="The source was large, so it was condensed into a structured outline instead of expanded."
            >
              condensed
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              latestDslGeneration.quality.densityStatus === 'target-met'
                ? 'bg-tertiary-100 text-tertiary-700'
                : latestDslGeneration.quality.densityStatus === 'below-target'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-accent-100 text-accent-800'
            }`}
          >
            {latestDslGeneration.quality.densityStatus === 'target-met'
              ? 'density ok'
              : latestDslGeneration.quality.densityStatus === 'below-target'
                ? 'below target'
                : 'over target'}
          </span>
          {latestDslGeneration.quality.densityStatus === 'below-target' ? (
            <span
              aria-label="DSL is lighter than preferred; regenerate with more detail."
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 bg-white text-[10px] font-semibold text-amber-800"
              role="img"
              title="DSL is lighter than preferred; regenerate with more detail."
            >
              i
            </span>
          ) : null}
          <span className="text-xs text-zinc-400">
            {latestDslGeneration.metrics.generatedMeaningfulLineCount} lines
            {' · '}
            {latestDslGeneration.metrics.expansionRatio.toFixed(2)}x
          </span>
        </div>
      ) : null}

      {/* ── Generation status ─────────────────────────────────────── */}
      {generationStatus.tone !== 'idle' ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-4 py-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(generationStatus.tone)}`}
          >
            DSL
          </span>
          <span className="text-xs text-zinc-500">{generationStatus.message}</span>
        </div>
      ) : null}

      {/* ── Attachment status ─────────────────────────────────────── */}
      {attachStatus ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-4 py-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(attachStatus.tone)}`}
          >
            File
          </span>
          <span className="text-xs text-zinc-500">{attachStatus.message}</span>
        </div>
      ) : null}

      {/* ── Action buttons ────────────────────────────────────────── */}
      <div className="flex shrink-0 gap-2 border-t border-zinc-100 px-4 py-3">
        <input
          accept={fileInputAccept}
          className="hidden"
          multiple
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            event.target.value = '';
            void handleFilesSelected(files);
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="flex-1 rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isGenerating}
          onClick={() => {
            onGenerateDsl();
          }}
          type="button"
        >
          {isGenerating
            ? 'Generating…'
            : `Generate ${selectedDetailLevel === 'detailed' ? 'detailed' : 'standard'} DSL`}
        </button>
        <button
          aria-label="Attach a .txt or .md file"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating || isReading}
          onClick={() => {
            fileInputRef.current?.click();
          }}
          title="Attach a .txt or .md file"
          type="button"
        >
          Attach
        </button>
        {latestDslGeneration?.quality.densityStatus === 'below-target' ? (
          <button
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isGenerating}
            onClick={() => {
              onGenerateDsl('detailed');
            }}
            type="button"
          >
            More detail
          </button>
        ) : null}
        <button
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          onClick={onClearNotes}
          type="button"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
