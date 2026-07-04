import { isProviderConfigured } from '../config/env.ts';
import {
  MODEL_PROVIDERS,
  getModelById,
  listModels,
  listModelsForRole,
  type ModelCatalogEntry,
  type ModelProvider,
  type ModelRole,
} from './catalog.ts';

type EnvRecord = Record<string, string | undefined>;

// A provider is "available" only when its API key is configured. These helpers
// intersect the static catalog with the providers the server can actually call,
// so the UI never offers a model whose credentials are missing.

export function listConfiguredProviders(env: EnvRecord = process.env): ModelProvider[] {
  return MODEL_PROVIDERS.filter((provider) => isProviderConfigured(provider, env));
}

export function isModelAvailable(modelId: string, env: EnvRecord = process.env): boolean {
  const entry = getModelById(modelId);
  return entry ? isProviderConfigured(entry.provider, env) : false;
}

export function listAvailableModels(env: EnvRecord = process.env): ModelCatalogEntry[] {
  return listModels().filter((entry) => isProviderConfigured(entry.provider, env));
}

export function listAvailableModelsForRole(
  role: ModelRole,
  env: EnvRecord = process.env,
): ModelCatalogEntry[] {
  return listModelsForRole(role).filter((entry) => isProviderConfigured(entry.provider, env));
}
