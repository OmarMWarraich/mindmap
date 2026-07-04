import { isModelAvailable } from './availability.ts';
import { getModelById, isKnownModelId, type ModelRole } from './catalog.ts';

type EnvRecord = Record<string, string | undefined>;

export const MODEL_ALLOWLIST_ENV_VAR = 'MODEL_ALLOWLIST';

export type ModelAuthorizationResult =
  | { ok: true; modelId: string }
  | { ok: false; status: 400 | 403; reason: string };

export interface AuthorizeModelIdOptions {
  role?: ModelRole;
  env?: EnvRecord;
}

// Optional ops-controlled allow-list of catalog ids (comma-separated env var).
// Returns null when unset, meaning "every known catalog id is allowed".
export function getModelAllowList(env: EnvRecord = process.env): ReadonlySet<string> | null {
  const raw = env[MODEL_ALLOWLIST_ENV_VAR]?.trim();

  if (!raw) {
    return null;
  }

  const ids = raw.split(',').map((value) => value.trim()).filter((value) => value.length > 0);
  return new Set(ids);
}

export function isModelAllowListed(modelId: string, env: EnvRecord = process.env): boolean {
  const allowList = getModelAllowList(env);
  return allowList ? allowList.has(modelId) : isKnownModelId(modelId);
}

// Server-side gate run before dispatching to a model. Confirms the id exists in
// the catalog, supports the requested role, is permitted by the allow-list, and
// has a configured provider. Returns a discriminated result with the HTTP status
// the caller should surface (400 for a malformed/unknown id, 403 when known but
// disallowed or unavailable).
export function authorizeModelId(
  modelId: string,
  options: AuthorizeModelIdOptions = {},
): ModelAuthorizationResult {
  const env = options.env ?? process.env;
  const entry = getModelById(modelId);

  if (!entry) {
    return { ok: false, status: 400, reason: `Unknown model id: ${modelId}` };
  }

  if (options.role && !entry.roles.includes(options.role)) {
    return { ok: false, status: 403, reason: `Model does not support the ${options.role} role: ${modelId}` };
  }

  if (!isModelAllowListed(modelId, env)) {
    return { ok: false, status: 403, reason: `Model is not permitted: ${modelId}` };
  }

  if (!isModelAvailable(modelId, env)) {
    return { ok: false, status: 403, reason: `Model provider is not configured for: ${modelId}` };
  }

  return { ok: true, modelId };
}
