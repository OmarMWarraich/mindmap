export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getModelProviderEnv } = await import("./lib/config/env");
    getModelProviderEnv();
  }
}
