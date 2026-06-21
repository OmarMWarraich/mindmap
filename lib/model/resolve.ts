import { getProviderCredentials } from '../config/env.ts';
import type { ModelAdapter, ModelAdapterCredentials, ModelAdapterRegistry } from './adapter.ts';
import { resolveModelAdapter } from './adapter.ts';
import { anthropicMessagesAdapter } from './anthropic-messages-adapter.ts';
import { getModelById, type ModelCatalogEntry } from './catalog.ts';
import { openaiCompatibleAdapter } from './openai-compatible-adapter.ts';

type EnvRecord = Record<string, string | undefined>;

// Default wire-format → adapter wiring. Keyed by wire format (not vendor) so any
// OpenAI-compatible vendor reuses one adapter and new vendors need only a catalog
// row plus a key.
export const defaultModelAdapterRegistry: ModelAdapterRegistry = {
  'openai-compatible': openaiCompatibleAdapter,
  'anthropic-messages': anthropicMessagesAdapter,
};

export interface ResolvedModel {
  entry: ModelCatalogEntry;
  adapter: ModelAdapter;
  credentials: ModelAdapterCredentials;
}

export interface ResolveModelOptions {
  env?: EnvRecord;
  registry?: ModelAdapterRegistry;
}

// Resolves everything needed to dispatch a request for a validated catalog model:
// the catalog entry (provider, wire-format model name, defaults, capabilities),
// the wire-format adapter, and the provider's server-side credentials. Credentials
// are read only from environment configuration — never accepted from or exposed to
// the client. Throws for an unknown id, an unregistered wire format, or a missing
// provider key (the last surfaced by `getProviderCredentials`).
export function resolveModel(modelId: string, options: ResolveModelOptions = {}): ResolvedModel {
  const entry = getModelById(modelId);

  if (!entry) {
    throw new Error(`Unknown model id: ${modelId}`);
  }

  const registry = options.registry ?? defaultModelAdapterRegistry;
  const adapter = resolveModelAdapter(registry, entry.wireFormat);
  const credentials = getProviderCredentials(entry.provider, options.env);

  return { entry, adapter, credentials };
}
