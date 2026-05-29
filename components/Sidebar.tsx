'use client';

import { useWorkspace } from './WorkspaceContext';
import type { ActivePanel } from './WorkspaceContext';

// ── Icons ─────────────────────────────────────────────────────────────────

function NotesIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function GuidesIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

// ── Nav item config ────────────────────────────────────────────────────────

interface NavItem {
  id: ActivePanel;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'notes',   label: 'Notes',   icon: <NotesIcon /> },
  { id: 'chat',    label: 'Chat',    icon: <ChatIcon /> },
  { id: 'guides',  label: 'Guides',  icon: <GuidesIcon /> },
  { id: 'history', label: 'History', icon: <HistoryIcon /> },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { activePanel, setActivePanel, projectName } = useWorkspace();

  return (
    <div className="flex h-full flex-col">
      {/* ── Project header ──────────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-4">
        <div className="mb-3 flex items-start gap-2.5">
          {/* Project icon — black square */}
          <div className="mt-0.5 h-7 w-7 shrink-0 rounded-md bg-primary-800" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary-900">{projectName}</p>
            <p className="text-xs text-zinc-400">Strategy Map</p>
          </div>
        </div>

        {/* Generate Branch CTA */}
        <button
          className="w-full rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 active:bg-accent-700"
          onClick={() => {
            setActivePanel('notes');
          }}
          type="button"
        >
          Generate Branch
        </button>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-1" aria-label="Workspace navigation">
        <ul className="grid gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activePanel === item.id;
            return (
              <li key={item.id}>
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent-50 text-accent-700'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
                  ].join(' ')}
                  onClick={() => {
                    setActivePanel(item.id);
                  }}
                  type="button"
                >
                  <span className={isActive ? 'text-accent-600' : 'text-zinc-400'}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Bottom links ────────────────────────────────────────────── */}
      <div className="border-t border-zinc-100 px-2 py-3">
        <ul className="grid gap-0.5">
          <li>
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
              type="button"
            >
              <span className="text-zinc-400"><SettingsIcon /></span>
              Settings
            </button>
          </li>
          <li>
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
              type="button"
            >
              <span className="text-zinc-400"><SupportIcon /></span>
              Support
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
