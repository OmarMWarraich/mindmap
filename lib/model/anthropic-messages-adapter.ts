import type {
  ModelAdapter,
  ModelChatCompletionRequest,
  ModelChatMessage,
  ModelHttpRequest,
  ModelStructuredOutput,
} from './adapter.ts';

const anthropicVersion = '2023-06-01';
const defaultAnthropicBaseUrl = 'https://api.anthropic.com/v1';
const defaultStructuredOutputToolName = 'json_output';

interface AnthropicContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
}

interface AnthropicTool {
  name: string;
  input_schema: object;
  strict?: boolean;
}

// Wire-format adapter for Anthropic's native Messages API. Speaks `x-api-key` +
// `anthropic-version` auth, lifts system turns to the top-level `system` field,
// and parses the `content[]` block array. Structured output is requested via a
// forced tool call (Anthropic's idiomatic JSON mechanism); the tool input is
// returned as a JSON string so callers parse it exactly like the OpenAI path.
export const anthropicMessagesAdapter: ModelAdapter = {
  wireFormat: 'anthropic-messages',
  buildRequest(request: ModelChatCompletionRequest): ModelHttpRequest {
    const systemPrompt = extractSystemPrompt(request.messages);
    const conversation = toAnthropicConversation(request.messages);
    const baseUrl = (request.credentials.baseUrl ?? defaultAnthropicBaseUrl).replace(/\/$/, '');
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: conversation,
    };

    if (request.structuredOutput) {
      const tool = toAnthropicTool(request.structuredOutput);
      body.tools = [tool];
      body.tool_choice = { type: 'tool', name: tool.name };
    }

    return {
      url: `${baseUrl}/messages`,
      init: {
        method: 'POST',
        headers: {
          'x-api-key': request.credentials.apiKey,
          'anthropic-version': anthropicVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    };
  },
  parseResponse(payload: unknown): string {
    return extractAnthropicText((payload ?? {}) as AnthropicMessagesResponse);
  },
};

function extractSystemPrompt(messages: ModelChatMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
}

function toAnthropicConversation(
  messages: ModelChatMessage[],
): Array<{ role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] }> {
  return messages
    .filter((message): message is ModelChatMessage & { role: 'user' | 'assistant' } =>
      message.role === 'user' || message.role === 'assistant')
    .map((message) => {
      if (typeof message.content === 'string') {
        return { role: message.role, content: message.content };
      }

      return {
        role: message.role,
        content: message.content.flatMap((part): AnthropicContentBlock[] => {
          if (part.type === 'text') {
            return [{ type: 'text', text: part.text }];
          }

          if (part.type === 'image_url') {
            const url = part.image_url.url;
            const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(url);
            if (!match) {
              return [{ type: 'text', text: url }];
            }

            return [{
              type: 'image',
              source: {
                type: 'base64',
                media_type: match[1],
                data: match[2],
              },
            }];
          }

          return [];
        }),
      };
    });
}

function toAnthropicTool(structuredOutput: ModelStructuredOutput): AnthropicTool {
  if (structuredOutput.kind === 'json_object') {
    return {
      name: defaultStructuredOutputToolName,
      input_schema: { type: 'object' },
    };
  }

  return {
    name: structuredOutput.name,
    input_schema: structuredOutput.schema,
    ...(structuredOutput.strict === undefined ? {} : { strict: structuredOutput.strict }),
  };
}

export function extractAnthropicText(payload: AnthropicMessagesResponse): string {
  const blocks = payload.content;

  if (!Array.isArray(blocks)) {
    return '';
  }

  const toolUseBlock = blocks.find(
    (block) => block.type === 'tool_use' && block.input !== undefined,
  );

  if (toolUseBlock) {
    return JSON.stringify(toolUseBlock.input);
  }

  return blocks
    .filter((block) => block.type === 'text' || block.text != null)
    .map((block) => block.text ?? '')
    .join('');
}
