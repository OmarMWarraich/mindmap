import { ZodError } from 'zod';

import {
  consumeInlineCompletionRateLimit,
  createInlineCompletionCacheKey,
  getCachedInlineCompletion,
  getInlineCompletionClientKey,
  setCachedInlineCompletion,
} from '../../../lib/completion/runtime-controls.ts';
import { inlineCompletionRequestSchema, generateInlineCompletion } from '../../../lib/completion/service.ts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = inlineCompletionRequestSchema.parse(await request.json());
    const clientKey = getInlineCompletionClientKey(request);
    const rateLimit = consumeInlineCompletionRateLimit(clientKey);

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
}