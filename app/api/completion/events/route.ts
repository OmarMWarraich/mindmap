import { ZodError } from 'zod';

import { auth } from '../../../../auth.ts';
import {
  inlineCompletionEventSchema,
  recordInlineCompletionEvent,
  type InlineCompletionEvent,
} from '../../../../lib/completion/instrumentation.ts';
import { describeError, logger } from '../../../../lib/observability/logger.ts';

export const runtime = 'nodejs';

export const POST = auth(async (req) => {
  const userId = req.auth?.user?.id;

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: InlineCompletionEvent;

  try {
    payload = inlineCompletionEventSchema.parse(await req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected completion event failure.';
    const status = error instanceof ZodError ? 400 : 500;

    if (status >= 500) {
      logger.error('completion event request failed', {
        route: 'POST /api/completion/events',
        status,
        ...describeError(error),
      });
    }

    return Response.json({ error: message }, { status });
  }

  // Telemetry is best-effort: a persistence failure is logged but never fails the
  // request (the client sends these with keepalive and ignores the response).
  try {
    await recordInlineCompletionEvent(payload, userId);
  } catch (error) {
    logger.error('failed to persist completion event', {
      route: 'POST /api/completion/events',
      ...describeError(error),
    });
  }

  return Response.json({ ok: true }, { status: 202 });
});
