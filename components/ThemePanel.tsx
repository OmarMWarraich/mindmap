'use client';

import { useState } from 'react';

import { mindmapThemePresets } from '../lib/mindmap/theme-presets';
import { requestMindmapThemeFromApi } from '../lib/styling/client';
import type { MindmapTheme } from '../lib/mindmap/theme';

interface ThemePanelProps {
  theme: MindmapTheme;
  onThemeChange: (theme: MindmapTheme) => void;
  mindmapTitle?: string;
  branchLabels?: string[];
  modelId?: string;
}

export default function ThemePanel({
  theme,
  onThemeChange,
  mindmapTitle,
  branchLabels,
  modelId,
}: ThemePanelProps) {
  const [stylePrompt, setStylePrompt] = useState('');
  const [restyleStatus, setRestyleStatus] = useState<{
    tone: 'idle' | 'progress' | 'success' | 'error';
    message: string;
  }>({ tone: 'idle', message: '' });
  const isRestyling = restyleStatus.tone === 'progress';

  async function handleRestyle(): Promise<void> {
    const trimmedPrompt = stylePrompt.trim();

    if (trimmedPrompt.length === 0) {
      setRestyleStatus({ tone: 'error', message: 'Describe a style first, e.g. "earthy forest tones".' });
      return;
    }

    setRestyleStatus({ tone: 'progress', message: 'Generating theme…' });

    try {
      const response = await requestMindmapThemeFromApi({
        stylePrompt: trimmedPrompt,
        mindmapTitle,
        branchLabels,
        modelId,
      });

      onThemeChange(response.theme);
      setRestyleStatus({
        tone: 'success',
        message: `Applied "${response.theme.name}"${response.quality.mode === 'retry' ? ' (after one retry)' : ''}.`,
      });
    } catch (error) {
      setRestyleStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Theme generation failed unexpectedly.',
      });
    }
  }

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

      <div className="flex gap-2 border-t border-zinc-100 px-4 py-3">
        <input
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-accent-400"
          disabled={isRestyling}
          maxLength={500}
          onChange={(event) => {
            setStylePrompt(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleRestyle();
            }
          }}
          placeholder="Describe a style — e.g. dark academia, ocean blues…"
          type="text"
          value={stylePrompt}
        />
        <button
          className="shrink-0 rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRestyling}
          onClick={() => {
            void handleRestyle();
          }}
          type="button"
        >
          {isRestyling ? 'Restyling…' : 'Restyle with AI'}
        </button>
      </div>

      {restyleStatus.tone !== 'idle' ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-4 py-2">
          <span
            className={[
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              restyleStatus.tone === 'success'
                ? 'bg-tertiary-100 text-tertiary-700'
                : restyleStatus.tone === 'error'
                  ? 'bg-accent2-100 text-accent2-700'
                  : 'bg-accent-100 text-accent-800',
            ].join(' ')}
          >
            AI
          </span>
          <span className="text-xs text-zinc-500">{restyleStatus.message}</span>
        </div>
      ) : null}
    </div>
  );
}
