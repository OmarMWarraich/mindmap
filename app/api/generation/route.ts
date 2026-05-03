import { ZodError } from 'zod';

import { generateMindmapOverlay, generationRequestSchema } from '../../../lib/generation/service.ts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = generationRequestSchema.parse(await request.json());
    const response = await generateMindmapOverlay(payload);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected generation route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    return Response.json({ error: message }, { status });
  }
}