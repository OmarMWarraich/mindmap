import { ZodError } from 'zod';

import { auth } from '../../../auth.ts';
import { generateMindmapOverlay, generationRequestSchema } from '../../../lib/generation/service.ts';

export const runtime = 'nodejs';

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = generationRequestSchema.parse(await req.json());
    const response = await generateMindmapOverlay(payload);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected generation route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    return Response.json({ error: message }, { status });
  }
});