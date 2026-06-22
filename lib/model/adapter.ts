import type { ModelWireFormat } from './catalog.ts';

export type ModelChatMessageRole = 'system' | 'user' | 'assistant';

export interface ModelChatMessage {
  role: ModelChatMessageRole;
  content: string;
}

// Resolved server-side credentials for a single request. Never sourced from the
// client — populated from per-provider environment configuration.
export interface ModelAdapterCredentials {
  apiKey: string;
  baseUrl?: string;
}

// Wire-format-neutral structured-output intent. Each adapter translates this into
// its provider's mechanism (OpenAI `response_format`, Anthropic tool use, or a
// prompt-only fallback).
export type ModelStructuredOutput =
  | { kind: 'json_object' }
  | {
      kind: 'json_schema';
      name: string;
      schema: object;
      strict?: boolean;
    };

// Provider-agnostic chat completion request. `model` is the concrete model name
// sent on the wire (e.g. the catalog entry `id`). `temperature` is omitted for
// models whose catalog capability marks `supportsTemperature: false`.
export interface ModelChatCompletionRequest {
  model: string;
  messages: ModelChatMessage[];
  maxTokens: number;
  temperature?: number;
  credentials: ModelAdapterCredentials;
  structuredOutput?: ModelStructuredOutput;
}

export interface ModelHttpRequest {
  url: string;
  init: RequestInit;
}

// A wire-format adapter owns the request/response shape for one HTTP protocol
// (e.g. `openai-compatible`, `anthropic-messages`). Multiple vendors that speak
// the same protocol share a single adapter.
export interface ModelAdapter {
  readonly wireFormat: ModelWireFormat;
  buildRequest(request: ModelChatCompletionRequest): ModelHttpRequest;
  parseResponse(payload: unknown): string;
}

// Adapters are keyed by wire format, not vendor name.
export type ModelAdapterRegistry = Partial<Record<ModelWireFormat, ModelAdapter>>;

export function resolveModelAdapter(
  registry: ModelAdapterRegistry,
  wireFormat: ModelWireFormat,
): ModelAdapter {
  const adapter = registry[wireFormat];

  if (!adapter) {
    throw new Error(`No model adapter registered for wire format: ${wireFormat}`);
  }

  return adapter;
}
