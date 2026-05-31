'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';

import { useWorkspace } from './WorkspaceContext';

export interface NavBarProps {
  modelProvider: string;
  userEmail?: string | null;
  userName?: string | null;
  signOutAction: () => Promise<void>;
}

const NAV_TABS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Workspace', href: '/workspace' },
  { label: 'Library',   href: '#' },
  { label: 'Helpdesk',  href: '#' },
  { label: 'History',   href: '#' },
];

function MindFlowIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 20 20"
      width="18"
    >
      <circle cx="10" cy="10" fill="currentColor" r="2.8" />
      <circle cx="3.5" cy="4.5" fill="currentColor" opacity="0.65" r="1.9" />
      <circle cx="16.5" cy="4.5" fill="currentColor" opacity="0.65" r="1.9" />
      <circle cx="3.5" cy="15.5" fill="currentColor" opacity="0.65" r="1.9" />
      <circle cx="16.5" cy="15.5" fill="currentColor" opacity="0.65" r="1.9" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="7.4" x2="5.0" y1="8.4" y2="6.1" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="12.6" x2="15.0" y1="8.4" y2="6.1" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="7.4" x2="5.0" y1="11.6" y2="13.9" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="12.6" x2="15.0" y1="11.6" y2="13.9" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function getUserInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'ME';
}

export default function NavBar({ modelProvider, userEmail, userName, signOutAction }: NavBarProps) {
  const pathname = usePathname();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const { setPreviewOpen } = useWorkspace();

  const initials = getUserInitials(userName, userEmail);

  return (
    <nav className="flex h-full items-center px-4">
      {/* ── Brand ──────────────────────────────────────────────────── */}
      <Link className="mr-5 flex shrink-0 items-center gap-1.5 text-primary-800 transition-colors hover:text-accent-700" href="/workspace">
        <MindFlowIcon />
        <span className="text-sm font-semibold tracking-tight">MindFlow</span>
      </Link>

      {/* ── Tab row ────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center gap-0.5">
        {NAV_TABS.map((tab) => {
          const isActive =
            tab.href !== '#' &&
            (tab.href === '/workspace' ? pathname === '/workspace' : pathname.startsWith(tab.href));
          return (
            <Link
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-50 text-accent-800'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
              ].join(' ')}
              href={tab.href}
              key={tab.label}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* ── Right cluster ──────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Model Preview pill — opens the preview drawer */}
        <button
          className="hidden items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-800 transition hover:bg-accent-100 sm:inline-flex"
          onClick={() => {
            setPreviewOpen(true);
          }}
          type="button"
        >
          Model Preview:
          <span className="font-semibold">{modelProvider}</span>
        </button>

        {/* Trained Notes badge */}
        <span className="hidden rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-800 lg:inline-flex">
          Trained Notes
        </span>

        {/* Download — wired to export action in Phase G */}
        <button
          aria-label="Download PNG (not yet available)"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled
          type="button"
        >
          <DownloadIcon />
        </button>

        {/* Avatar dropdown */}
        <div className="relative" ref={avatarRef}>
          <button
            aria-expanded={avatarOpen}
            aria-haspopup="menu"
            aria-label="User menu"
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
            onClick={() => {
              setAvatarOpen((prev) => !prev);
            }}
            type="button"
          >
            {initials}
          </button>

          {avatarOpen && (
            <>
              {/* Click-outside backdrop */}
              <div
                aria-hidden="true"
                className="fixed inset-0 z-10"
                onClick={() => {
                  setAvatarOpen(false);
                }}
              />
              {/* Dropdown menu */}
              <div
                className="absolute right-0 top-full z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
                role="menu"
              >
                {userEmail && (
                  <div className="border-b border-zinc-100 px-3 py-2.5">
                    <p className="truncate text-xs text-zinc-400">{userEmail}</p>
                  </div>
                )}
                <form action={signOutAction}>
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                    role="menuitem"
                    type="submit"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
