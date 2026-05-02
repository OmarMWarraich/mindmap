import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildModelProviderChatCompletionRequest,
  extractAssistantText,
} from './provider.ts';

test('buildModelProviderChatCompletionRequest targets the OpenAI chat completions endpoint', () => {
  const request = buildModelProviderChatCompletionRequest({
    env: {
      MODEL_PROVIDER: 'openai',
      MODEL_API_KEY: 'test-key',
      MODEL_BASE_URL: undefined,
      MODEL_COMPLETION_MODEL: 'gpt-5-mini',
      MODEL_GENERATION_MODEL: 'gpt-5',
    },
    messages: [{ role: 'system', content: 'system prompt' }],
  });

  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal((request.init.headers as Record<string, string>).Authorization, 'Bearer test-key');
  assert.match(String(request.init.body), /"model":"gpt-5-mini"/);
});

test('buildModelProviderChatCompletionRequest targets the OpenRouter chat completions endpoint', () => {
  const request = buildModelProviderChatCompletionRequest({
    env: {
      MODEL_PROVIDER: 'openrouter',
      MODEL_API_KEY: 'router-key',
      MODEL_BASE_URL: undefined,
      MODEL_COMPLETION_MODEL: 'openai/gpt-5-mini',
      MODEL_GENERATION_MODEL: 'openai/gpt-5',
    },
    messages: [{ role: 'user', content: 'user prompt' }],
  });

  assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal((request.init.headers as Record<string, string>).Authorization, 'Bearer router-key');
});

test('buildModelProviderChatCompletionRequest targets the Azure OpenAI deployment endpoint', () => {
  const request = buildModelProviderChatCompletionRequest({
    env: {
      MODEL_PROVIDER: 'azure-openai',
      MODEL_API_KEY: 'azure-key',
      MODEL_BASE_URL: 'https://contoso.openai.azure.com',
      MODEL_COMPLETION_MODEL: 'gpt-4o-mini-deployment',
      MODEL_GENERATION_MODEL: 'gpt-4o-deployment',
    },
    messages: [{ role: 'user', content: 'user prompt' }],
  });

  assert.equal(
    request.url,
    'https://contoso.openai.azure.com/openai/deployments/gpt-4o-mini-deployment/chat/completions?api-version=2024-10-21',
  );
  assert.equal((request.init.headers as Record<string, string>)['api-key'], 'azure-key');
  assert.equal(String(request.init.body).includes('"model"'), false);
});

test('extractAssistantText supports both string and text-part chat payloads', () => {
  assert.equal(
    extractAssistantText({
      choices: [{ message: { content: '  - ATP synthase' } }],
    }),
    '  - ATP synthase',
  );

  assert.equal(
    extractAssistantText({
      choices: [{ message: { content: [{ type: 'text', text: '  - proton gradient' }] } }],
    }),
    '  - proton gradient',
  );
});