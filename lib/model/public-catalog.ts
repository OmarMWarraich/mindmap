import { isModelAllowListed } from './authorization.ts';
import { listAvailableModels, listAvailableModelsForRole } from './availability.ts';
import type {
  ModelCatalogEntry,
  ModelProvider,
  ModelRole,
  StructuredOutputStrategy,
} from './catalog.ts';

type EnvRecord = Record<string, string | undefined>;

// Client-safe projection of a catalog entry. Adapter credentials (api keys, base
// urls) live only in server env and are never part of a catalog entry, but
// mapping field-by-field here guarantees a future catalog field cannot silently
// leak to the client. Internal routing details (e.g. wireFormat) are also omitted
// since the UI only needs to render and group the dropdown.
export interface PublicModel {
  id: string;
  provider: ModelProvider;
  label: string;
  roles: ModelRole[];
  capabilities: {
    structuredOutput: StructuredOutputStrategy;
    contextWindow: number;
  };
  defaults: {
    temperature: number;
    maxTokens: number;
  };
}

export function toPublicModel(entry: ModelCatalogEntry): PublicModel {
  return {
    id: entry.id,
    provider: entry.provider,
    label: entry.label,
    roles: [...entry.roles],
    capabilities: {
      structuredOutput: entry.capabilities.structuredOutput,
      contextWindow: entry.capabilities.contextWindow,
    },
    defaults: {
      temperature: entry.defaults.temperature,
      maxTokens: entry.defaults.maxTokens,
    },
  };
}

export interface ListPublicModelsOptions {
  role?: ModelRole;
  env?: EnvRecord;
}

// The models the UI may offer: catalog entries whose provider is configured and
// which the ops allow-list permits, projected to non-secret fields. Optionally
// narrowed to a single role so the completion and generation selectors each get
// only the models valid for them.
export function listPublicModels(options: ListPublicModelsOptions = {}): PublicModel[] {
  const env = options.env ?? process.env;
  const available = options.role
    ? listAvailableModelsForRole(options.role, env)
    : listAvailableModels(env);

  return available
    .filter((entry) => isModelAllowListed(entry.id, env))
    .map(toPublicModel);
}
