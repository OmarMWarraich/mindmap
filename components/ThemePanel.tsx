'use client';

import { mindmapThemePresets } from '../lib/mindmap/theme-presets';
import type { MindmapTheme } from '../lib/mindmap/theme';

interface ThemePanelProps {
  theme: MindmapTheme;
  onThemeChange: (theme: MindmapTheme) => void;
}

export default function ThemePanel({ theme, onThemeChange }: ThemePanelProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2.5">
        <div className="grid gap-0.5">
          <h2 className="text-sm font-semibold text-zinc-900">Theme</h2>
          <p className="text-xs text-zinc-500">Applies to preview and PNG export</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {mindmapThemePresets.map((preset) => (
          <button
            aria-pressed={theme.name === preset.name}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition',
              theme.name === preset.name
                ? 'bg-primary-800 text-white'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50',
            ].join(' ')}
            key={preset.name}
            onClick={() => {
              onThemeChange(preset);
            }}
            type="button"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
