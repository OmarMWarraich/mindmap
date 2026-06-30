export interface RateLimitOutcome {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiterStoreConfig {
  windowMs: number;
  maxRequests: number;
}

// Backing store for inline-completion rate limiting. `now` is injectable so the
// in-memory adapter stays deterministic under test; remote adapters that rely on
// server-side TTLs ignore it.
export interface RateLimiterStore {
  consume(key: string, now: number): Promise<RateLimitOutcome>;
  // Clears local state. A no-op for remote/shared adapters.
  reset(): void;
}

interface RateLimitWindow {
  count: number;
  windowStartedAt: number;
}

// Fixed window measured from the first request for a key (preserves the original
// module-local limiter's semantics). Correct for a single process; per-instance on
// serverless — which is why a distributed adapter exists.
export function createInMemoryRateLimiterStore(
  config: RateLimiterStoreConfig,
): RateLimiterStore {
  const entries = new Map<string, RateLimitWindow>();

  return {
    async consume(key, now) {
      const entry = entries.get(key);

      if (!entry || entry.windowStartedAt + config.windowMs <= now) {
        entries.set(key, { count: 1, windowStartedAt: now });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (entry.count >= config.maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((entry.windowStartedAt + config.windowMs - now) / 1000),
          ),
        };
      }

      entry.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset() {
      entries.clear();
    },
  };
}

const rateLimitWindowMs = 30_000;
const rateLimitMaxRequests = 18;

let cachedStore: RateLimiterStore | null = null;

// Process-wide singleton so all requests share one limiter instance. The backing
// adapter is selected once; see resetRateLimiterStoreForTests to rebuild it.
export function getRateLimiterStore(): RateLimiterStore {
  if (!cachedStore) {
    cachedStore = createInMemoryRateLimiterStore({
      windowMs: rateLimitWindowMs,
      maxRequests: rateLimitMaxRequests,
    });
  }

  return cachedStore;
}

export function resetRateLimiterStoreForTests(): void {
  cachedStore?.reset();
  cachedStore = null;
}
