import type { ModelProviderEnv } from '../config/env.ts';
import { resolveModelDefaults } from './catalog.ts';
import type {
  ModelAdapter,
  ModelChatCompletionRequest,
  ModelChatMessage,
  ModelHttpRequest,
  ModelStructuredOutput,
} from './adapter.ts';

export interface ModelProviderChatMessage {
  role: 'system' | 'user';
  content: string;
}

type OpenAiChatResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict?: boolean;
        schema: object;
      };
    };

interface OpenAiChatCompletionPayload {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
}

export interface RequestModelProviderChatCompletionOptions {
  env: ModelProviderEnv;
  fetchImpl?: typeof fetch;
  messages: ModelProviderChatMessage[];
  maxCompletionTokens?: number;
  model?: string;
  responseFormat?: OpenAiChatResponseFormat;
  temperature?: number;
}

const defaultFetchImpl: typeof fetch = (...args) => fetch(...args);
const azureApiVersion = '2024-10-21';
const defaultOpenAiBaseUrl = 'https://api.openai.com/v1';

export async function requestModelProviderChatCompletion(
  options: RequestModelProviderChatCompletionOptions,
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? defaultFetchImpl;
  const request = buildModelProviderChatCompletionRequest(options);
  const response = await fetchImpl(request.url, request.init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Model completion request failed with ${response.status}: ${message}`);
  }

  const payload = await response.json() as OpenAiChatCompletionPayload;

  return extractAssistantText(payload);
}

export function buildModelProviderChatCompletionRequest(
  options: RequestModelProviderChatCompletionOptions,
): ModelHttpRequest {
  const { env } = options;
  const model = options.model ?? env.MODEL_COMPLETION_MODEL;
  const modelDefaults = resolveModelDefaults(model);
  const temperature = options.temperature ?? modelDefaults.temperature;
  const maxCompletionTokens = options.maxCompletionTokens ?? modelDefaults.maxTokens;
  const requestBody = buildChatCompletionRequestBody({
    messages: options.messages,
    maxCompletionTokens,
    temperature,
    responseFormat: options.responseFormat,
  });

  if (env.MODEL_PROVIDER === 'azure-openai') {
    const baseUrl = (env.MODEL_BASE_URL ?? '').replace(/\/$/, '');

    if (!baseUrl) {
      throw new Error('MODEL_BASE_URL is required for azure-openai completion requests.');
    }

    return {
      url: `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=${azureApiVersion}`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.MODEL_API_KEY,
        },
        body: JSON.stringify(requestBody),
      },
    };
  }

  const baseUrl = (env.MODEL_BASE_URL ?? getDefaultProviderBaseUrl(env.MODEL_PROVIDER)).replace(/\/$/, '');

  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MODEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        ...requestBody,
      }),
    },
  };
}

export function extractAssistantText(payload: OpenAiChatCompletionPayload): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text' || part.text != null)
      .map((part) => part.text ?? '')
      .join('');
  }

  return '';
}

// Wire-format adapter for the OpenAI chat-completions protocol, shared by OpenAI,
// OpenRouter, and other OpenAI-compatible vendors. Credentials are resolved
// server-side; this adapter never reads environment configuration directly.
export const openaiCompatibleAdapter: ModelAdapter = {
  wireFormat: 'openai-compatible',
  buildRequest(request: ModelChatCompletionRequest): ModelHttpRequest {
    const requestBody = buildChatCompletionRequestBody({
      messages: request.messages,
      maxCompletionTokens: request.maxTokens,
      temperature: request.temperature,
      responseFormat: request.structuredOutput
        ? toOpenAiResponseFormat(request.structuredOutput)
        : undefined,
    });
    const baseUrl = (request.credentials.baseUrl ?? defaultOpenAiBaseUrl).replace(/\/$/, '');

    return {
      url: `${baseUrl}/chat/completions`,
      init: {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${request.credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          ...requestBody,
        }),
      },
    };
  },
  parseResponse(payload: unknown): string {
    return extractAssistantText((payload ?? {}) as OpenAiChatCompletionPayload);
  },
};

function buildChatCompletionRequestBody(params: {
  messages: ModelChatMessage[];
  maxCompletionTokens: number;
  temperature: number;
  responseFormat?: OpenAiChatResponseFormat;
}): Record<string, unknown> {
  return {
    messages: params.messages,
    max_completion_tokens: params.maxCompletionTokens,
    temperature: params.temperature,
    n: 1,
    ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
  };
}

function toOpenAiResponseFormat(structuredOutput: ModelStructuredOutput): OpenAiChatResponseFormat {
  if (structuredOutput.kind === 'json_object') {
    return { type: 'json_object' };
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: structuredOutput.name,
      ...(structuredOutput.strict === undefined ? {} : { strict: structuredOutput.strict }),
      schema: structuredOutput.schema,
    },
  };
}

function getDefaultProviderBaseUrl(provider: ModelProviderEnv['MODEL_PROVIDER']): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    default:
      return '';
  }
}
