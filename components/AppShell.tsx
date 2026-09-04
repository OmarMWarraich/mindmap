'use client';

import React, { useState } from "react";

interface AppShellProps {
  nav: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <line x1="3" x2="21" y1="6" y2="6" />
      <line x1="3" x2="21" y1="12" y2="12" />
      <line x1="3" x2="21" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
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
 * The parent `.workspace-shell` div supplies the constrained viewport height.
 * Individual panels scroll within themselves; nothing scrolls at shell level.
 * On mobile (< md) the sidebar collapses into a slide-in drawer behind a
 * hamburger toggle in the header.
 */
export default function AppShell({ nav, sidebar, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-50">
      {/* ── Top nav bar ─────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white">
        <button
          aria-expanded={isSidebarOpen}
          aria-label="Toggle sidebar"
          className="ml-2 rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 md:hidden"
          onClick={() => {
            setIsSidebarOpen((open) => !open);
          }}
          type="button"
        >
          <MenuIcon />
        </button>
        <div className="h-full min-w-0 flex-1">{nav}</div>
      </header>

      {/* ── Below nav: sidebar + main ───────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1">
        {/* Desktop sidebar (static) */}
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white md:block">
          {sidebar}
        </aside>

        {/* Mobile sidebar (retractable drawer) */}
        {isSidebarOpen ? (
          <div className="absolute inset-0 z-40 md:hidden">
            {/* Backdrop */}
            <button
              aria-label="Close sidebar"
              className="absolute inset-0 bg-primary-900/40"
              onClick={() => {
                setIsSidebarOpen(false);
              }}
              type="button"
            />
            <aside className="relative flex h-full w-60 flex-col overflow-y-auto border-r border-zinc-200 bg-white shadow-xl">
              <button
                aria-label="Close sidebar"
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => {
                  setIsSidebarOpen(false);
                }}
                type="button"
              >
                <CloseIcon />
              </button>
              {/* Close after any sidebar action (e.g. switching panels). */}
              <div
                className="flex-1"
                onClickCapture={(event) => {
                  if ((event.target as HTMLElement).closest('button')) {
                    setIsSidebarOpen(false);
                  }
                }}
              >
                {sidebar}
              </div>
            </aside>
          </div>
        ) : null}

        {/* Main content — fills remaining space, scrolls internally */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
