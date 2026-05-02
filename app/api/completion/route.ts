import { ZodError } from 'zod';

import { inlineCompletionRequestSchema, generateInlineCompletion } from '../../../lib/completion/service.ts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = inlineCompletionRequestSchema.parse(await request.json());
    const response = await generateInlineCompletion(payload);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected completion route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    return Response.json({ error: message }, { status });
  }
}