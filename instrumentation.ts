export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAtLeastOneProviderConfigured } = await import("./lib/config/env");
    assertAtLeastOneProviderConfigured();
  }
}
