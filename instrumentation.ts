export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAtLeastOneProviderConfigured } = await import("./lib/config/env");
    assertAtLeastOneProviderConfigured();

    // Initialize the rate-limiter store at boot so a partial Upstash configuration
    // fails fast, and the per-instance guardrail warning prints once on startup
    // rather than on the first completion request.
    const { getRateLimiterStore } = await import("./lib/completion/rate-limiter-store");
    getRateLimiterStore();
  }
}
