import type {
  ModelAdapter,
  ModelChatCompletionRequest,
  ModelChatMessage,
  ModelHttpRequest,
  ModelStructuredOutput,
} from './adapter.ts';

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

const defaultOpenAiBaseUrl = 'https://api.openai.com/v1';

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

function buildChatCompletionRequestBody(params: {
  messages: ModelChatMessage[];
  maxCompletionTokens: number;
  temperature?: number;
  responseFormat?: OpenAiChatResponseFormat;
}): Record<string, unknown> {
  return {
    messages: params.messages,
    max_completion_tokens: params.maxCompletionTokens,
    ...(params.temperature === undefined ? {} : { temperature: params.temperature }),
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
