import { getModelById, selectModelIdForRole } from '../model/catalog.ts';
import type { InlineCompletionRequest, InlineCompletionResponse } from './service.ts';

interface InlineCompletionCacheEntry {
  expiresAt: number;
  response: InlineCompletionResponse;
}

interface InlineCompletionRateLimitEntry {
  count: number;
  windowStartedAt: number;
}

const completionCache = new Map<string, InlineCompletionCacheEntry>();
const rateLimitEntries = new Map<string, InlineCompletionRateLimitEntry>();

const completionCacheTtlMs = 15_000;
const rateLimitWindowMs = 30_000;
const rateLimitMaxRequests = 18;

export function createInlineCompletionCacheKey(request: InlineCompletionRequest): string {
  return JSON.stringify([
    // The effective model (requested id or the completion-role default) so a
    // cached completion is never served for a different model. Resolving the
    // default here means an omitted `modelId` and an explicit default-equal id
    // share one cache entry, since they dispatch to the same model.
    selectModelIdForRole('completion', request.modelId),
    request.outline,
    request.cursor.lineNumber,
    request.cursor.column,
    request.recentTokenBudget ?? null,
  ]);
}

export function getCachedInlineCompletion(
  cacheKey: string,
  now = Date.now(),
): InlineCompletionResponse | null {
  const entry = completionCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    completionCache.delete(cacheKey);
    return null;
  }

  return entry.response;
}

export function setCachedInlineCompletion(
  cacheKey: string,
  response: InlineCompletionResponse,
  now = Date.now(),
): void {
  completionCache.set(cacheKey, {
    expiresAt: now + completionCacheTtlMs,
    response,
  });
}

export function consumeInlineCompletionRateLimit(
  clientKey: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const entry = rateLimitEntries.get(clientKey);

  if (!entry || entry.windowStartedAt + rateLimitWindowMs <= now) {
    rateLimitEntries.set(clientKey, {
      count: 1,
      windowStartedAt: now,
    });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= rateLimitMaxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStartedAt + rateLimitWindowMs - now) / 1000)),
    };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getInlineCompletionClientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? 'anonymous';
}

// Resolves the upstream provider for the request's effective completion model so
// each provider gets an independent budget. This keeps one provider's burst (or
// upstream 429s) from consuming another provider's allowance and lets us reason
// about per-provider cost separately.
export function getInlineCompletionProvider(request: InlineCompletionRequest): string {
  const modelId = selectModelIdForRole('completion', request.modelId);
  return getModelById(modelId)?.provider ?? 'unknown';
}

// Composite key that scopes the per-client rate-limit window to a single
// provider, e.g. "203.0.113.7:openai" vs "203.0.113.7:anthropic".
export function getInlineCompletionRateLimitKey(
  httpRequest: Request,
  request: InlineCompletionRequest,
): string {
  return `${getInlineCompletionClientKey(httpRequest)}:${getInlineCompletionProvider(request)}`;
}

export function resetInlineCompletionRuntimeControlsForTests(): void {
  completionCache.clear();
  rateLimitEntries.clear();
}