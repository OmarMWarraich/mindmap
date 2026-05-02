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

export function resetInlineCompletionRuntimeControlsForTests(): void {
  completionCache.clear();
  rateLimitEntries.clear();
}