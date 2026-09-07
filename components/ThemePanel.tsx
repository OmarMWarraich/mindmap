'use client';

import { useState } from 'react';

import { mindmapThemePresets } from '../lib/mindmap/theme-presets';
import { requestMindmapBackgroundFromApi, requestMindmapThemeFromApi } from '../lib/styling/client';
import type { MindmapTheme } from '../lib/mindmap/theme';

interface ThemePanelProps {
  theme: MindmapTheme;
  onThemeChange: (theme: MindmapTheme) => void;
  mindmapTitle?: string;
  branchLabels?: string[];
  modelId?: string;
}

type ArtisticStylePreset = {
  id: string;
  label: string;
  prompt: string;
  backgroundPrompt: string;
  description: string;
  metadata: {
    id: string;
    label: string;
    mood: string;
    palette: string[];
    lighting: string;
    layout: string;
    background: string;
    description: string;
  };
};

const artisticStylePresets: readonly ArtisticStylePreset[] = [
  {
    id: 'office',
    label: 'office',
    prompt: 'clean office productivity design with neutral grays, deep blue accents, structured surfaces, soft shadows, polished corporate visual language',
    backgroundPrompt: 'modern office workspace with clean neutral tones, soft daylight, tidy desk, polished corporate aesthetic',
    description: 'Professional office productivity look with structured clarity',
    metadata: {
      id: 'office',
      label: 'office',
      mood: 'calm, focused, professional',
      palette: ['slate', 'navy', 'soft gray'],
      lighting: 'soft daylight',
      layout: 'structured, clean, balanced',
      background: 'tidy office workspace',
      description: 'Professional office productivity look with structured clarity',
    },
  },
  {
    id: 'memo',
    label: 'memo',
    prompt: 'memo-style presentation with paper textures, warm ivory backgrounds, subtle graphite lines, understated annotations, executive briefing aesthetic',
    backgroundPrompt: 'paper memo board with warm ivory tones, soft pencil annotations, minimal briefing details',
    description: 'Warm paper notes and concise briefing aesthetic',
    metadata: {
      id: 'memo',
      label: 'memo',
      mood: 'warm, concise, analytical',
      palette: ['ivory', 'graphite', 'stone'],
      lighting: 'soft studio light',
      layout: 'editorial, compact, note-based',
      background: 'paper memo board',
      description: 'Warm paper notes and concise briefing aesthetic',
    },
  },
  {
    id: 'application',
    label: 'application',
    prompt: 'application UI mood with clean app-shell surfaces, soft elevation, crisp components, blue-gray interface palette, calm product design tone',
    backgroundPrompt: 'clean app dashboard layout with soft shadows, blue-gray interface palette, minimal product design surfaces',
    description: 'UI-style product mockup with structured clarity',
    metadata: {
      id: 'application',
      label: 'application',
      mood: 'calm, product-driven, polished',
      palette: ['blue-gray', 'slate', 'soft white'],
      lighting: 'soft interface glow',
      layout: 'structured app shell, layered panels',
      background: 'clean dashboard surfaces',
      description: 'UI-style product mockup with structured clarity',
    },
  },
  {
    id: 'correspondence',
    label: 'correspondence',
    prompt: 'formal correspondence aesthetic with letterhead elegance, muted ink colors, refined serif typography, elegant spacing, structured memo layout',
    backgroundPrompt: 'elegant letterhead composition with refined neutral palette, soft shadows, formal correspondence style',
    description: 'Formal, paper-based professional correspondence',
    metadata: {
      id: 'correspondence',
      label: 'correspondence',
      mood: 'formal, refined, composed',
      palette: ['ink', 'stone', 'warm ivory'],
      lighting: 'soft archival light',
      layout: 'letterhead, structured, elegant',
      background: 'formal memo and letterhead composition',
      description: 'Formal, paper-based professional correspondence',
    },
  },
  {
    id: 'mindmap',
    label: 'mindmap',
    prompt: 'mindmap-focused visual system with clear hierarchical blocks, subtle connective lines, balanced density, readable labels, calm academic color palette',
    backgroundPrompt: 'organized mindmap board with clean hierarchy, balanced spacing, readable branches, calm academic palette',
    description: 'Mind map style tuned for clarity and branch structure',
    metadata: {
      id: 'mindmap',
      label: 'mindmap',
      mood: 'clarity, structure, calm',
      palette: ['sage', 'slate', 'linen'],
      lighting: 'soft north light',
      layout: 'clean hierarchy, balanced branch density',
      background: 'organized mindmap board',
      description: 'Mind map style tuned for clarity and branch structure',
    },
  },
  {
    id: 'nodes',
    label: 'nodes',
    prompt: 'node-centered composition with circular and rounded card clusters, soft layered fills, readable adjacency cues, airy but dense knowledge graph styling',
    backgroundPrompt: 'knowledge graph board with circular node clusters, layered card structure, airy spacing, soft contextual color',
    description: 'Node-heavy knowledge graph aesthetic',
    metadata: {
      id: 'nodes',
      label: 'nodes',
      mood: 'connected, airy, conceptual',
      palette: ['dusty blue', 'lavender', 'stone'],
      lighting: 'soft diffused studio light',
      layout: 'node clusters, layered, graph-like',
      background: 'knowledge graph board',
      description: 'Node-heavy knowledge graph aesthetic',
    },
  },
  {
    id: 'dark-academia',
    label: 'dark academia',
    prompt: 'dark academia style with deep charcoal backgrounds, warm parchment neutrals, antique gold accents, scholarly mood, elegant high-contrast study environment',
    backgroundPrompt: 'dark academia study space with parchment paper, deep charcoal walls, warm antique gold and moody library lighting',
    description: 'Moody library and scholarly study aesthetic',
    metadata: {
      id: 'dark-academia',
      label: 'dark academia',
      mood: 'scholarly, moody, elegant',
      palette: ['charcoal', 'parchment', 'antique gold'],
      lighting: 'library lantern glow',
      layout: 'structured, editorial, balanced',
      background: 'study hall with parchment textures',
      description: 'Moody library and scholarly study aesthetic',
    },
  },
  {
    id: 'ocean-blues',
    label: 'ocean blues',
    prompt: 'ocean blues aesthetic with layered teal and sapphire tones, calm sea gradients, crisp structure, light coastal contrast, polished modern marine palette',
    backgroundPrompt: 'coastal ocean scene with layered teal, sapphire, and seafoam tones, soft light, calm marine atmosphere',
    description: 'Calm marine palette with clean structured composition',
    metadata: {
      id: 'ocean-blues',
      label: 'ocean blues',
      mood: 'calm, buoyant, polished',
      palette: ['teal', 'sapphire', 'seafoam'],
      lighting: 'soft coastal daylight',
      layout: 'crisp, layered, airy',
      background: 'coastal ocean scene',
      description: 'Calm marine palette with clean structured composition',
    },
  },
  {
    id: 'forest',
    label: 'forest',
    prompt: 'forest-inspired design with rich green gradients, earthy natural textures, subtle organic movement, balanced readability, calm natural study palette',
    backgroundPrompt: 'lush forest scene with rich green gradients, soft atmospheric light, natural organic textures and calm depth',
    description: 'Earthy natural palette with organic depth',
    metadata: {
      id: 'forest',
      label: 'forest',
      mood: 'grounded, organic, serene',
      palette: ['forest green', 'moss', 'fern'],
      lighting: 'soft morning mist',
      layout: 'fluid, balanced, natural',
      background: 'lush forest atmosphere',
      description: 'Earthy natural palette with organic depth',
    },
  },
  {
    id: 'sunset-poster',
    label: 'sunset poster',
    prompt: 'sunset poster mood with warm coral, amber, and rose gradients, cinematic contrast, posterized shapes, expressive but readable layout',
    backgroundPrompt: 'cinematic sunset poster composition with warm coral, amber, and rose tones, bold but balanced color fields',
    description: 'Warm poster aesthetic with cinematic depth',
    metadata: {
      id: 'sunset-poster',
      label: 'sunset poster',
      mood: 'expressive, cinematic, warm',
      palette: ['coral', 'amber', 'rose'],
      lighting: 'golden dusk glow',
      layout: 'posterized, bold, readable',
      background: 'cinematic sunset poster scene',
      description: 'Warm poster aesthetic with cinematic depth',
    },
  },
] as const;

export default function ThemePanel({
  theme,
  onThemeChange,
  mindmapTitle,
  branchLabels,
  modelId,
}: ThemePanelProps) {
  const [stylePrompt, setStylePrompt] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [restyleStatus, setRestyleStatus] = useState<{
    tone: 'idle' | 'progress' | 'success' | 'error';
    message: string;
  }>({ tone: 'idle', message: '' });
  const isRestyling = restyleStatus.tone === 'progress';

  function applyArtisticPreset(preset: ArtisticStylePreset): void {
    setSelectedPresetId(preset.id);
    setStylePrompt(preset.prompt);
  }

  async function handleRestyle(): Promise<void> {
    const trimmedPrompt = stylePrompt.trim();

    if (trimmedPrompt.length === 0) {
      setRestyleStatus({ tone: 'error', message: 'Describe a style first, e.g. "earthy forest tones".' });
      return;
    }

    setRestyleStatus({ tone: 'progress', message: 'Generating theme…' });

    const selectedPreset = artisticStylePresets.find((preset) => preset.id === selectedPresetId);

    try {
      const response = await requestMindmapThemeFromApi({
        stylePrompt: trimmedPrompt,
        styleMetadata: selectedPreset?.metadata,
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

  async function handleGenerateBackground(): Promise<void> {
    const trimmedPrompt = stylePrompt.trim();

    if (trimmedPrompt.length === 0) {
      setRestyleStatus({ tone: 'error', message: 'Describe a style first, e.g. "misty forest at dawn".' });
      return;
    }

    const selectedPreset = artisticStylePresets.find((preset) => preset.id === selectedPresetId);
    const apiPrompt = selectedPreset?.backgroundPrompt ?? trimmedPrompt;

    setRestyleStatus({ tone: 'progress', message: 'Generating background image… this can take a moment.' });

    try {
      const response = await requestMindmapBackgroundFromApi({
        stylePrompt: apiPrompt,
        styleMetadata: selectedPreset?.metadata,
        mindmapTitle,
      });

      onThemeChange({
        ...theme,
        name: 'Custom',
        background: {
          kind: 'image',
          imageDataUrl: response.imageDataUrl,
          overlayColor: '#0f172a',
          overlayOpacity: 0.25,
        },
        node: {
          ...theme.node,
          // Photo backgrounds need node backing to keep text legible.
          frostOpacity: Math.max(theme.node.frostOpacity, 0.75),
        },
      });
      setRestyleStatus({ tone: 'success', message: 'Applied the generated background.' });
    } catch (error) {
      setRestyleStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Background generation failed unexpectedly.',
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

      <div className="flex flex-col gap-2 border-t border-zinc-100 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {artisticStylePresets.map((preset) => (
            <button
              className={[
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                selectedPresetId === preset.id
                  ? 'border-accent-300 bg-accent-50 text-accent-700'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700',
              ].join(' ')}
              key={preset.id}
              onClick={() => {
                applyArtisticPreset(preset);
              }}
              title={preset.description}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            aria-label="Style prompt"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-accent-400"
            disabled={isRestyling}
            list="theme-style-suggestions"
            maxLength={500}
            onChange={(event) => {
              const nextValue = event.target.value;
              setStylePrompt(nextValue);

              if (selectedPresetId) {
                const matchesPreset = artisticStylePresets.some(
                  (preset) => preset.id === selectedPresetId && preset.prompt === nextValue,
                );

                if (!matchesPreset) {
                  setSelectedPresetId(null);
                }
              }
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
          <datalist id="theme-style-suggestions">
            {artisticStylePresets.map((preset) => (
              <option key={preset.id} label={preset.label} value={preset.prompt} />
            ))}
          </datalist>

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
          <button
            aria-label="Generate an AI background image from the style description"
            className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRestyling}
            onClick={() => {
              void handleGenerateBackground();
            }}
            title="Generate an AI background image from the style description"
            type="button"
          >
            AI background
          </button>
        </div>
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
