'use client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  projectId: string;
  createdAt: string;
  detailLevel: string;
  dsl: string;
  densityStatus: string;
  nodeCount: number;
  rawNotes: string;
}

interface GenerationHistoryPanelProps {
  entries: HistoryEntry[];
  loading: boolean;
  onRestore: (entry: HistoryEntry) => void;
  onBack: () => void;
}

// ── Icons ─────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function HistoryEmptyIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function densityBadgeClass(status: string): string {
  if (status === 'target-met') return 'bg-accent-50 text-accent-700';
  if (status === 'below-target') return 'bg-amber-100 text-amber-700';
  return 'bg-zinc-100 text-zinc-600';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function GenerationHistoryPanel({
  entries,
  loading,
  onRestore,
  onBack,
}: GenerationHistoryPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Generation History</h2>
          {entries.length > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-500">
              {entries.length}
            </span>
          )}
        </div>
        <button
          aria-label="Back to notes"
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
          onClick={onBack}
          type="button"
        >
          <ChevronLeftIcon />
          Notes
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-zinc-400">Loading history…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              <HistoryEmptyIcon />
            </div>
            <p className="text-sm font-medium text-zinc-600">No generations yet</p>
            <p className="text-xs text-zinc-400">Generate DSL from your notes to see history here.</p>
          </div>
        ) : (
          <ul className="grid gap-2 p-4">
            {entries.map((entry) => (
              <li
                className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
                key={entry.id}
              >
                <div className="grid min-w-0 gap-1.5">
                  <p className="text-xs tabular-nums text-zinc-400">
                    {formatTimestamp(entry.createdAt)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {entry.detailLevel}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${densityBadgeClass(entry.densityStatus)}`}
                    >
                      {entry.densityStatus}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {entry.nodeCount} nodes
                    </span>
                  </div>
                </div>
                <button
                  className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                  onClick={() => {
                    onRestore(entry);
                  }}
                  type="button"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
