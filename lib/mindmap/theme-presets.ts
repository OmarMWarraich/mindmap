import type { MindmapTheme } from './theme.ts';
import { defaultMindmapTheme } from './theme.ts';

export const forestMindmapTheme: MindmapTheme = {
  version: 1,
  name: 'Forest',
  background: { kind: 'gradient', from: '#14532d', to: '#052e16', angle: 135 },
  typography: { ...defaultMindmapTheme.typography, nodeFontScale: 1.1 },
  node: {
    fillOpacity: 0.94,
    cornerRadiusScale: 1,
    strokeWidthScale: 1,
    frostOpacity: 0.85,
  },
  edge: { strokeWidthScale: 1, opacity: 0.85, colorMode: 'mono', monoColor: '#86efac' },
};

export const darkMindmapTheme: MindmapTheme = {
  version: 1,
  name: 'Dark',
  background: { kind: 'solid', color: '#0f172a' },
  typography: defaultMindmapTheme.typography,
  node: {
    fillOpacity: 1,
    cornerRadiusScale: 1,
    strokeWidthScale: 1,
    frostOpacity: 0,
  },
  edge: { strokeWidthScale: 1, opacity: 0.85, colorMode: 'branch' },
};

export const blueprintMindmapTheme: MindmapTheme = {
  version: 1,
  name: 'Blueprint',
  background: { kind: 'solid', color: '#0c4a6e' },
  typography: defaultMindmapTheme.typography,
  node: {
    fillOpacity: 1,
    cornerRadiusScale: 0.6,
    strokeWidthScale: 1,
    frostOpacity: 0,
    root: { fill: '#082f49', stroke: '#7dd3fc', text: '#e0f2fe', accent: '#38bdf8' },
    branch: { fill: '#0c4a6e', stroke: '#7dd3fc', text: '#e0f2fe', accent: '#38bdf8' },
    leaf: { fill: '#0c4a6e', stroke: '#38bdf8', text: '#bae6fd', accent: '#0ea5e9' },
  },
  edge: { strokeWidthScale: 0.8, opacity: 0.9, colorMode: 'mono', monoColor: '#bae6fd' },
};

export const pastelMindmapTheme: MindmapTheme = {
  version: 1,
  name: 'Pastel',
  background: { kind: 'gradient', from: '#fdf2f8', to: '#eff6ff', angle: 160 },
  typography: defaultMindmapTheme.typography,
  node: {
    fillOpacity: 1,
    cornerRadiusScale: 1.3,
    strokeWidthScale: 0.8,
    frostOpacity: 0,
  },
  edge: { strokeWidthScale: 1, opacity: 0.6, colorMode: 'branch' },
};

export const mindmapThemePresets: readonly MindmapTheme[] = [
  defaultMindmapTheme,
  forestMindmapTheme,
  darkMindmapTheme,
  blueprintMindmapTheme,
  pastelMindmapTheme,
];

export function getMindmapThemePresetByName(name: string): MindmapTheme | null {
  return mindmapThemePresets.find((preset) => preset.name === name) ?? null;
}
