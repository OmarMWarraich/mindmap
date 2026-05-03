import type { ModelProviderEnv } from '../config/env.ts';

export interface ModelProviderChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface RequestModelProviderChatCompletionOptions {
  env: ModelProviderEnv;
  fetchImpl?: typeof fetch;
  messages: ModelProviderChatMessage[];
  maxCompletionTokens?: number;
  model?: string;
  responseFormat?: {
    type: 'json_object';
  } | {
    type: 'json_schema';
    json_schema: {
      name: string;
      strict?: boolean;
      schema: object;
    };
  };
  temperature?: number;
}

const defaultFetchImpl: typeof fetch = (...args) => fetch(...args);
const azureApiVersion = '2024-10-21';

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

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string; type?: string }>;
      };
    }>;
  };

  return extractAssistantText(payload);
}

export function buildModelProviderChatCompletionRequest(
  options: RequestModelProviderChatCompletionOptions,
): { url: string; init: RequestInit } {
  const { env } = options;
  const temperature = options.temperature ?? 0.2;
  const maxCompletionTokens = options.maxCompletionTokens ?? 72;
  const model = options.model ?? env.MODEL_COMPLETION_MODEL;
  const requestBody = {
    messages: options.messages,
    max_completion_tokens: maxCompletionTokens,
    temperature,
    n: 1,
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
  };

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

export function extractAssistantText(payload: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
}): string {
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