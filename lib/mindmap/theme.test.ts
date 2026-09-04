import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultMindmapTheme, mindmapThemeSchema, parseMindmapTheme } from './theme.ts';

test('mindmapThemeSchema accepts the default theme', () => {
  const result = mindmapThemeSchema.safeParse(defaultMindmapTheme);

  assert.equal(result.success, true);
});

test('parseMindmapTheme returns a validated theme payload', () => {
  const theme = parseMindmapTheme({
    ...defaultMindmapTheme,
    name: 'Forest',
    background: {
      kind: 'image',
      imageDataUrl: 'data:image/png;base64,abc123',
      overlayColor: '#052e16',
      overlayOpacity: 0.35,
    },
    node: { ...defaultMindmapTheme.node, frostOpacity: 0.7 },
  });

  assert.equal(theme?.name, 'Forest');
  assert.equal(theme?.background.kind, 'image');
  assert.equal(theme?.node.frostOpacity, 0.7);
});

test('parseMindmapTheme rejects remote background image URLs', () => {
  const theme = parseMindmapTheme({
    ...defaultMindmapTheme,
    background: {
      kind: 'image',
      imageDataUrl: 'https://example.com/bg.png',
      overlayColor: '#000000',
      overlayOpacity: 0.4,
    },
  });

  assert.equal(theme, null);
});

test('parseMindmapTheme rejects mono edge mode without a mono color', () => {
  const theme = parseMindmapTheme({
    ...defaultMindmapTheme,
    edge: { strokeWidthScale: 1, opacity: 0.72, colorMode: 'mono' },
  });

  assert.equal(theme, null);
});

test('parseMindmapTheme rejects unknown properties', () => {
  const theme = parseMindmapTheme({
    ...defaultMindmapTheme,
    sparkle: true,
  });

  assert.equal(theme, null);
});
