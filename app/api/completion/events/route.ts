import { ZodError } from 'zod';

import { auth } from '../../../../auth.ts';
import {
  inlineCompletionEventSchema,
  recordInlineCompletionEvent,
} from '../../../../lib/completion/instrumentation.ts';

export const runtime = 'nodejs';

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = inlineCompletionEventSchema.parse(await req.json());
    recordInlineCompletionEvent(payload);
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected completion event failure.';
    const status = error instanceof ZodError ? 400 : 500;

    return Response.json({ error: message }, { status });
  }
});