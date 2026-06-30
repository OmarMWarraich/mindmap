import { ZodError } from 'zod';

import { auth } from '../../../auth.ts';
import {
  consumeInlineCompletionRateLimit,
  createInlineCompletionCacheKey,
  getCachedInlineCompletion,
  getInlineCompletionRateLimitKey,
  setCachedInlineCompletion,
} from '../../../lib/completion/runtime-controls.ts';
import { inlineCompletionRequestSchema, generateInlineCompletion } from '../../../lib/completion/service.ts';
import { authorizeModelId } from '../../../lib/model/authorization.ts';

export const runtime = 'nodejs';

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = inlineCompletionRequestSchema.parse(await req.json());

    if (payload.modelId) {
      const authorization = authorizeModelId(payload.modelId, { role: 'completion' });

      if (!authorization.ok) {
        return Response.json({ error: authorization.reason }, { status: authorization.status });
      }
    }

    const clientKey = getInlineCompletionRateLimitKey(req, payload);
    const rateLimit = await consumeInlineCompletionRateLimit(clientKey);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many inline completion requests.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const cacheKey = createInlineCompletionCacheKey(payload);
    const cachedResponse = getCachedInlineCompletion(cacheKey);

    if (cachedResponse) {
      return Response.json(cachedResponse);
    }

    const response = await generateInlineCompletion(payload);
    setCachedInlineCompletion(cacheKey, response);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected completion route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    return Response.json({ error: message }, { status });
  }
});
