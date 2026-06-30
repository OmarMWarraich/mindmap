import type { RateLimitOutcome, RateLimiterStore, RateLimiterStoreConfig } from './rate-limiter-store.ts';

export interface UpstashRateLimiterStoreOptions extends RateLimiterStoreConfig {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
}

interface UpstashCommandResult {
  result?: unknown;
  error?: string;
}

const keyPrefix = 'mindmap:ratelimit:';

// Distributed fixed-window-from-first-request limiter backed by Upstash Redis over
// its REST API (HTTP — serverless-friendly, no persistent TCP socket). One pipelined
// round-trip per check:
//   INCR          -> current count in the window
//   PEXPIRE … NX  -> set the TTL only on the first hit, so the window is measured from
//                    the first request (matching the in-memory adapter)
//   PTTL          -> remaining window, used to derive Retry-After
// Fails OPEN: any transport or protocol error allows the request rather than blocking
// completions on a cache outage.
export function createUpstashRateLimiterStore(
  options: UpstashRateLimiterStoreOptions,
): RateLimiterStore {
  const endpoint = `${options.url.replace(/\/$/, '')}/pipeline`;
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  return {
    async consume(key: string, now: number): Promise<RateLimitOutcome> {
      void now;
      const redisKey = `${keyPrefix}${key}`;
      const commands = [
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(options.windowMs), 'NX'],
        ['PTTL', redisKey],
      ];

      let results: UpstashCommandResult[];

      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(commands),
        });

        if (!response.ok) {
          return allowOnFailure();
        }

        results = (await response.json()) as UpstashCommandResult[];
      } catch {
        return allowOnFailure();
      }

      if (!Array.isArray(results) || results.length < 3 || results.some((entry) => entry?.error)) {
        return allowOnFailure();
      }

      const count = Number(results[0]?.result);
      const pttlMs = Number(results[2]?.result);

      if (!Number.isFinite(count)) {
        return allowOnFailure();
      }

      if (count <= options.maxRequests) {
        return { allowed: true, retryAfterSeconds: 0 };
      }

      const remainingMs = Number.isFinite(pttlMs) && pttlMs > 0 ? pttlMs : options.windowMs;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
    },
    reset() {
      // Remote shared state — not reset from an app process.
    },
  };
}

// Fail open: never block a completion because the rate-limit store is unavailable.
function allowOnFailure(): RateLimitOutcome {
  return { allowed: true, retryAfterSeconds: 0 };
}
