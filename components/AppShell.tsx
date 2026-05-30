import React from "react";

interface AppShellProps {
  nav: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Fixed full-viewport three-zone layout:
 *   ┌─────────────────────────────────────┐
 *   │  nav bar  (h-14, shrink-0)          │
 *   ├───────────┬─────────────────────────┤
 *   │  sidebar  │  main content           │
 *   │  (w-60)   │  (flex-1, overflow-y)   │
 *   └───────────┴─────────────────────────┘
 *
 * Body/html are already `h-full overflow-hidden` (Phase A globals.css).
 * Individual panels scroll within themselves; nothing scrolls at shell level.
 */
export default function AppShell({ nav, sidebar, children }: AppShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-50">
      {/* ── Top nav bar ─────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 border-b border-zinc-200 bg-white">
        {nav}
      </header>

      {/* ── Below nav: sidebar + main ───────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white">
          {sidebar}
        </aside>

        {/* Main content — fills remaining space, scrolls internally */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
