import { z } from 'zod';

const requiredString = z.string().trim().min(1);

// Data URIs only: remote URLs would taint the export canvas (CORS).
const imageDataUrl = z.string().regex(/^data:image\//, 'Background images must be data URIs.');

export const mindmapThemeBackgroundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('grid') }).strict(),
  z.object({ kind: z.literal('solid'), color: requiredString }).strict(),
  z
    .object({
      kind: z.literal('gradient'),
      from: requiredString,
      to: requiredString,
      angle: z.number().min(0).max(360),
    })
    .strict(),
  z
    .object({
      kind: z.literal('image'),
      imageDataUrl,
      overlayColor: requiredString,
      overlayOpacity: z.number().min(0).max(1),
    })
    .strict(),
]);

export type MindmapThemeBackground = z.infer<typeof mindmapThemeBackgroundSchema>;

export const mindmapThemeNodeOverrideSchema = z
  .object({
    fill: requiredString.optional(),
    stroke: requiredString.optional(),
    text: requiredString.optional(),
    accent: requiredString.optional(),
  })
  .strict();

export type MindmapThemeNodeOverride = z.infer<typeof mindmapThemeNodeOverrideSchema>;

export const mindmapThemeSchema = z
  .object({
    version: z.literal(1),
    name: requiredString,
    background: mindmapThemeBackgroundSchema,
    typography: z
      .object({
        fontFamily: requiredString,
        rootFontScale: z.number().min(0.5).max(3),
        nodeFontScale: z.number().min(0.5).max(3),
      })
      .strict(),
    node: z
      .object({
        fillOpacity: z.number().min(0).max(1),
        cornerRadiusScale: z.number().min(0.2).max(3),
        strokeWidthScale: z.number().min(0.2).max(3),
        // Opaque white backing behind each node; keeps text readable over image backgrounds.
        frostOpacity: z.number().min(0).max(1),
        root: mindmapThemeNodeOverrideSchema.optional(),
        branch: mindmapThemeNodeOverrideSchema.optional(),
        leaf: mindmapThemeNodeOverrideSchema.optional(),
      })
      .strict(),
    edge: z
      .object({
        strokeWidthScale: z.number().min(0.2).max(3),
        opacity: z.number().min(0).max(1),
        colorMode: z.enum(['branch', 'mono']),
        monoColor: requiredString.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((theme, ctx) => {
    if (theme.edge.colorMode === 'mono' && !theme.edge.monoColor) {
      ctx.addIssue({
        code: 'custom',
        path: ['edge', 'monoColor'],
        message: 'monoColor is required when colorMode is "mono".',
      });
    }
  });

export type MindmapTheme = z.infer<typeof mindmapThemeSchema>;

// Reproduces the pre-theme hardcoded look exactly; rendering with this theme
// must be byte-identical to rendering with no theme.
export const defaultMindmapTheme: MindmapTheme = {
  version: 1,
  name: 'Classic',
  background: { kind: 'grid' },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    rootFontScale: 1,
    nodeFontScale: 1,
  },
  node: {
    fillOpacity: 1,
    cornerRadiusScale: 1,
    strokeWidthScale: 1,
    frostOpacity: 0,
  },
  edge: {
    strokeWidthScale: 1,
    opacity: 0.72,
    colorMode: 'branch',
  },
};

export function parseMindmapTheme(value: unknown): MindmapTheme | null {
  const result = mindmapThemeSchema.safeParse(value);
  return result.success ? result.data : null;
}
