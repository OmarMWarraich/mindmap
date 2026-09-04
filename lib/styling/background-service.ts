import { z } from 'zod';

const requiredString = z.string().trim().min(1);

export const mindmapBackgroundGenerationRequestSchema = z.object({
  stylePrompt: requiredString.max(500, 'Style prompt is too long. Keep it under 500 characters.'),
  mindmapTitle: z.string().trim().max(200).optional(),
}).strict();

export type MindmapBackgroundGenerationRequest = z.infer<typeof mindmapBackgroundGenerationRequestSchema>;

export const mindmapBackgroundGenerationResponseSchema = z.object({
  imageDataUrl: z.string().regex(/^data:image\//),
  bytes: z.number().int().positive(),
}).strict();

export type MindmapBackgroundGenerationResponse = z.infer<typeof mindmapBackgroundGenerationResponseSchema>;

// Keeps the draft payload well under the ~4.5MB serverless request cap once the
// data URL is persisted to the cloud draft alongside the rest of the workspace.
export const maxBackgroundImageBytes = 3_000_000;

const openAiImagesEndpoint = 'https://api.openai.com/v1/images/generations';
const defaultImageModelId = 'gpt-image-1';

export function buildBackgroundImagePrompt(stylePrompt: string, mindmapTitle?: string): string {
  return [
    'A subtle, atmospheric background texture for a study mindmap diagram.',
    `Style: ${stylePrompt}.`,
    ...(mindmapTitle ? [`The mindmap topic is "${mindmapTitle}"; evoke it only through mood and color.`] : []),
    'Soft, low-contrast, evenly lit, no focal subject in the center.',
    'Absolutely no text, letters, numbers, words, logos, or diagrams in the image.',
  ].join(' ');
}

export async function generateMindmapBackgroundImage(
  request: MindmapBackgroundGenerationRequest,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<MindmapBackgroundGenerationResponse> {
  const validatedRequest = mindmapBackgroundGenerationRequestSchema.parse(request);
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Background image generation requires the OpenAI API key to be configured.');
  }

  const response = await fetchImpl(openAiImagesEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL_ID ?? defaultImageModelId,
      prompt: buildBackgroundImagePrompt(validatedRequest.stylePrompt, validatedRequest.mindmapTitle),
      size: '1024x1024',
      quality: 'low',
      output_format: 'jpeg',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Background image generation failed with ${response.status}: ${detail}`);
  }

  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const base64 = payload.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error('The image model returned no image data.');
  }

  const bytes = Math.floor(base64.length * 0.75);

  if (bytes > maxBackgroundImageBytes) {
    throw new Error('The generated background image is too large to store. Try a simpler style.');
  }

  return mindmapBackgroundGenerationResponseSchema.parse({
    imageDataUrl: `data:image/jpeg;base64,${base64}`,
    bytes,
  });
}
