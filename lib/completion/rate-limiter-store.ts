import { createUpstashRateLimiterStore } from './upstash-rate-limiter-store.ts';

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

type EnvRecord = Record<string, string | undefined>;

// Selects the backing store from configuration. With both Upstash REST variables set,
// rate limiting is enforced globally across instances; with neither, it falls back to
// the in-memory adapter (per-instance). A partial configuration is almost certainly a
// mistake, so fail loudly rather than silently degrade to per-instance limiting.
export function createRateLimiterStore(
  config: RateLimiterStoreConfig,
  env: EnvRecord = process.env,
): RateLimiterStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    return createUpstashRateLimiterStore({ ...config, url, token });
  }

  if (url || token) {
    throw new Error(
      'Incomplete Upstash configuration: set both UPSTASH_REDIS_REST_URL and ' +
        'UPSTASH_REDIS_REST_TOKEN, or neither.',
    );
  }

  // No shared store configured: limiting is per-instance. Warn once where the app
  // very likely runs multiple instances; stay quiet in local dev.
  if (isLikelyMultiInstance(env)) {
    console.warn(
      '[rate-limit] No UPSTASH_REDIS_REST_URL/TOKEN configured — inline-completion ' +
        'rate limiting is per-instance and will not enforce a global budget across ' +
        'serverless instances. See README.md#inline-completion-rate-limiting-optional-distributed.',
    );
  }

  return createInMemoryRateLimiterStore(config);
}

function isLikelyMultiInstance(env: EnvRecord): boolean {
  return env.VERCEL === '1' || env.NODE_ENV === 'production';
}

let cachedStore: RateLimiterStore | null = null;

// Process-wide singleton so all requests share one limiter instance. The backing
// adapter is selected once; see resetRateLimiterStoreForTests to rebuild it.
export function getRateLimiterStore(): RateLimiterStore {
  if (!cachedStore) {
    cachedStore = createRateLimiterStore({
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
