import { z } from 'zod';

// ~3.6MB of base64 keeps the request under the serverless body cap.
const maxInputImageCharacters = 4_800_000;

const inputImageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpeg);base64,/, 'The mindmap image must be a PNG or JPEG data URI.')
  .max(maxInputImageCharacters, 'The mindmap image is too large. Export at a smaller size.');

export const artisticExportRequestSchema = z.object({
  imageDataUrl: inputImageDataUrl,
  stylePrompt: z.string().trim().max(500).optional(),
  mindmapTitle: z.string().trim().max(200).optional(),
}).strict();

export type ArtisticExportRequest = z.infer<typeof artisticExportRequestSchema>;

export const artisticExportResponseSchema = z.object({
  imageDataUrl: z.string().regex(/^data:image\//),
  disclaimer: z.string(),
}).strict();

export type ArtisticExportResponse = z.infer<typeof artisticExportResponseSchema>;

export const artisticExportDisclaimer =
  'AI-stylized rendering — node text and fine details may be inaccurate. Use the faithful PNG export for studying.';

const openAiImageEditsEndpoint = 'https://api.openai.com/v1/images/edits';
const defaultImageModelId = 'gpt-image-1';

export function buildArtisticExportPrompt(stylePrompt?: string, mindmapTitle?: string): string {
  return [
    'Re-render this mindmap diagram as a rich, beautiful illustrated poster.',
    'Keep the exact node layout, connections, and hierarchy.',
    'Reproduce every node label as legibly as possible.',
    ...(mindmapTitle ? [`The central topic is "${mindmapTitle}".`] : []),
    stylePrompt
      ? `Art direction: ${stylePrompt}.`
      : 'Art direction: warm, atmospheric, softly textured background with dimensional node cards.',
  ].join(' ');
}

export async function generateArtisticMindmapExport(
  request: ArtisticExportRequest,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<ArtisticExportResponse> {
  const validatedRequest = artisticExportRequestSchema.parse(request);
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Artistic export requires the OpenAI API key to be configured.');
  }

  const form = new FormData();
  form.append('model', env.OPENAI_IMAGE_MODEL_ID ?? defaultImageModelId);
  form.append('prompt', buildArtisticExportPrompt(validatedRequest.stylePrompt, validatedRequest.mindmapTitle));
  form.append('image', dataUrlToBlob(validatedRequest.imageDataUrl), 'mindmap.png');

  const response = await fetchImpl(openAiImageEditsEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Artistic export failed with ${response.status}: ${detail}`);
  }

  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const base64 = payload.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error('The image model returned no image data.');
  }

  return artisticExportResponseSchema.parse({
    imageDataUrl: `data:image/png;base64,${base64}`,
    disclaimer: artisticExportDisclaimer,
  });
}

// atob-based so the module stays importable from client bundles (no Buffer).
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = /^data:(image\/(?:png|jpeg));base64$/.exec(meta ?? '')?.[1] ?? 'image/png';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}
