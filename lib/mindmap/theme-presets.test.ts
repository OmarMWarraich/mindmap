import assert from 'node:assert/strict';
import test from 'node:test';

import { mindmapThemePresets } from './theme-presets.ts';
import { defaultMindmapTheme, mindmapThemeSchema } from './theme.ts';

test('every theme preset validates against the theme schema', () => {
  for (const preset of mindmapThemePresets) {
    const result = mindmapThemeSchema.safeParse(preset);

    assert.equal(result.success, true, `Preset "${preset.name}" failed validation.`);
  }
});

test('preset names are unique and include the default theme', () => {
  const names = mindmapThemePresets.map((preset) => preset.name);

  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes(defaultMindmapTheme.name));
});
