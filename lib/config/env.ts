import { z } from "zod";

import type { ModelAdapterCredentials } from "../model/adapter.ts";
import { MODEL_PROVIDERS, type ModelProvider } from "../model/catalog.ts";

const requiredValue = (name: string) =>
  z
    .string()
    .trim()
    .min(1, `${name} is required`)
    .refine((value) => !value.startsWith("replace-with-"), {
      message: `${name} must be set to a real value`,
    });

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "environment";
      return `- ${key}: ${issue.message}`;
    })
    .join("\n");
}

// Boot-time guard. The server runs as long as at least one provider's key is
// configured; this replaces the legacy all-or-nothing single-provider validation
// so a deploy that sets only (say) OPENAI_API_KEY starts cleanly. Per-provider keys
// are still validated lazily at first use by `getProviderCredentials`.
export function assertAtLeastOneProviderConfigured(
  env: Record<string, string | undefined> = process.env,
): void {
  const hasConfiguredProvider = MODEL_PROVIDERS.some((provider) =>
    isProviderConfigured(provider, env),
  );

  if (!hasConfiguredProvider) {
    const envVarNames = MODEL_PROVIDERS.map(
      (provider) => PROVIDER_API_KEY_ENV_VARS[provider],
    ).join(", ");
    throw new Error(
      `No model provider is configured. Set at least one provider API key (${envVarNames}).`,
    );
  }
}

// Per-provider API key environment variables. A provider's key is validated
// lazily — only when a model belonging to that provider is actually used — so
// the server can hold credentials for several providers without forcing every
// key to be set. The `satisfies` clause keeps this map in sync with the catalog
// `ModelProvider` enum: adding a provider there forces a mapping entry here.
//
// DeepSeek is OpenAI-compatible and will join the catalog in a later phase:
//   DEEPSEEK_API_KEY=replace-with-real-deepseek-key
const PROVIDER_API_KEY_ENV_VARS = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
} as const satisfies Record<ModelProvider, string>;

export function getProviderApiKeyEnvVarName(provider: ModelProvider): string {
  return PROVIDER_API_KEY_ENV_VARS[provider];
}

// True when the provider's API key is present and not a placeholder. Never
// throws — used to derive which providers (and therefore which catalog models)
// the server may offer.
export function isProviderConfigured(
  provider: ModelProvider,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const envVarName = PROVIDER_API_KEY_ENV_VARS[provider];
  return requiredValue(envVarName).safeParse(env[envVarName]).success;
}

// Resolves server-side credentials for a provider, validating the key on demand.
// Throws a descriptive error when the key is missing so the failure is easy to
// diagnose at the point a provider's model is requested.
export function getProviderCredentials(
  provider: ModelProvider,
  env: Record<string, string | undefined> = process.env,
): ModelAdapterCredentials {
  const envVarName = PROVIDER_API_KEY_ENV_VARS[provider];
  const parsed = requiredValue(envVarName).safeParse(env[envVarName]);

  if (!parsed.success) {
    throw new Error(
      `Missing or invalid credentials for provider "${provider}". ` +
        `Set ${envVarName} to use ${provider} models.\n${formatIssues(parsed.error)}`,
    );
  }

  return { apiKey: parsed.data };
}