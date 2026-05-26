import { ZodError } from 'zod';

import {
  generateMindmapDslFromSource,
  sourceMindmapGenerationRequestSchema,
} from '../../../../lib/generation/source-service.ts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = sourceMindmapGenerationRequestSchema.parse(await request.json());
    const response = await generateMindmapDslFromSource(payload);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected source generation route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    return Response.json({ error: message }, { status });
  }
}