import type {
  ModelAdapterRegistry,
  ModelChatCompletionRequest,
  ModelChatMessage,
  ModelStructuredOutput,
} from './adapter.ts';
import type { ModelRole, StructuredOutputStrategy } from './catalog.ts';
import { resolveModelForRole } from './resolve.ts';

type EnvRecord = Record<string, string | undefined>;

const defaultFetchImpl: typeof fetch = (...args) => fetch(...args);

export interface StructuredModelCompletionOptions {
  role: ModelRole;
  modelId?: string;
  messages: ModelChatMessage[];
  maxTokens: number;
  temperature?: number;
  // Desired JSON structure. Applied only when the resolved model's catalog
  // capability is a native mechanism (`response_format` or `tool`); the adapter
  // translates it to the provider's wire shape. For `prompt`-capability models it
  // is omitted and the caller relies on prompt instructions + a robust JSON parse.
  structuredOutput?: ModelStructuredOutput;
  env?: EnvRecord;
  registry?: ModelAdapterRegistry;
  fetchImpl?: typeof fetch;
}

export interface StructuredModelCompletionResult {
  text: string;
  modelId: string;
  structuredOutputStrategy: StructuredOutputStrategy;
}

// Resolves the model for a role (honoring an explicit `modelId` or the role
// default), selects the structured-output strategy from the model's catalog
// capabilities, dispatches through the model's wire-format adapter, and returns
// the parsed assistant text. Credentials and base URLs come only from server env
// via `resolveModelForRole`.
export async function requestStructuredModelCompletion(
  options: StructuredModelCompletionOptions,
): Promise<StructuredModelCompletionResult> {
  const resolved = resolveModelForRole(options.role, options.modelId, {
    env: options.env,
    registry: options.registry,
  });
  const strategy = resolved.entry.capabilities.structuredOutput;
  const useNativeStructuredOutput = strategy !== 'prompt' && options.structuredOutput !== undefined;

  // Models that reject a non-default temperature (e.g. GPT-5.5, Claude Opus
  // 4.7/4.8) omit the field entirely rather than sending the catalog default.
  const temperature = resolved.entry.capabilities.supportsTemperature
    ? (options.temperature ?? resolved.entry.defaults.temperature)
    : undefined;

  const request: ModelChatCompletionRequest = {
    model: resolved.entry.id,
    messages: options.messages,
    maxTokens: options.maxTokens,
    credentials: resolved.credentials,
    ...(temperature === undefined ? {} : { temperature }),
    ...(useNativeStructuredOutput ? { structuredOutput: options.structuredOutput } : {}),
  };

  const httpRequest = resolved.adapter.buildRequest(request);
  const fetchImpl = options.fetchImpl ?? defaultFetchImpl;
  const response = await fetchImpl(httpRequest.url, httpRequest.init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Model completion request failed with ${response.status}: ${message}`);
  }

  const payload = await response.json() as unknown;

  return {
    text: resolved.adapter.parseResponse(payload),
    modelId: resolved.entry.id,
    structuredOutputStrategy: strategy,
  };
}
