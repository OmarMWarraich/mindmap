import { ZodError } from 'zod';

import {
  inlineCompletionEventSchema,
  recordInlineCompletionEvent,
} from '../../../../lib/completion/instrumentation.ts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = inlineCompletionEventSchema.parse(await request.json());
    recordInlineCompletionEvent(payload);
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected completion event failure.';
    const status = error instanceof ZodError ? 400 : 500;

    return Response.json({ error: message }, { status });
  }
}