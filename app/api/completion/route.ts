import { ZodError } from 'zod';

import { withUser } from '../../../lib/api/guards.ts';
import { errorResponse } from '../../../lib/api/responses.ts';
import {
  consumeInlineCompletionRateLimit,
  createInlineCompletionCacheKey,
  getCachedInlineCompletion,
  getInlineCompletionRateLimitKey,
  setCachedInlineCompletion,
} from '../../../lib/completion/runtime-controls.ts';
import { inlineCompletionRequestSchema, generateInlineCompletion } from '../../../lib/completion/service.ts';
import { authorizeModelId } from '../../../lib/model/authorization.ts';
import { describeError, logger } from '../../../lib/observability/logger.ts';

export const runtime = 'nodejs';

export const POST = withUser(async (req) => {
  try {
    const payload = inlineCompletionRequestSchema.parse(await req.json());

    if (payload.modelId) {
      const authorization = authorizeModelId(payload.modelId, { role: 'completion' });

      if (!authorization.ok) {
        return errorResponse(authorization.reason, authorization.status);
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

    if (status >= 500) {
      logger.error('inline completion request failed', {
        route: 'POST /api/completion',
        status,
        ...describeError(error),
      });
    }

    return errorResponse(message, status);
  }
});
