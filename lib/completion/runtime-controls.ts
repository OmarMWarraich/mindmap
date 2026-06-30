import { getModelById, selectModelIdForRole } from '../model/catalog.ts';
import {
  getRateLimiterStore,
  resetRateLimiterStoreForTests,
  type RateLimitOutcome,
} from './rate-limiter-store.ts';
import type { InlineCompletionRequest, InlineCompletionResponse } from './service.ts';

interface InlineCompletionCacheEntry {
  expiresAt: number;
  response: InlineCompletionResponse;
}

// The completion cache is intentionally process-local. Its key is one user's exact
// editor state (effective model + outline + cursor), so the cross-instance hit rate
// is effectively zero; backing it with a shared store would add a network round-trip
// to the latency-sensitive ghost-text path for no real benefit. Rate limiting — which
// must be enforced globally — is what uses the shared store (see rate-limiter-store.ts
// and README.md#inline-completion-rate-limiting-optional-distributed for the trade-off).
const completionCache = new Map<string, InlineCompletionCacheEntry>();

const completionCacheTtlMs = 15_000;

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

// Delegates to the configured rate-limiter store (in-memory by default, Upstash Redis
// when configured). Async so a distributed backing store can be awaited; the in-memory
// store resolves immediately.
export function consumeInlineCompletionRateLimit(
  clientKey: string,
  now = Date.now(),
): Promise<RateLimitOutcome> {
  return getRateLimiterStore().consume(clientKey, now);
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
  resetRateLimiterStoreForTests();
}
