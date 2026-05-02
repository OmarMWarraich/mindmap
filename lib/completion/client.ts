import type { InlineCompletionRequest } from './service.ts';

interface InlineCompletionClientResponse {
  completionText: string;
  source: 'model';
}

export async function requestInlineCompletionFromApi(
  request: InlineCompletionRequest,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<InlineCompletionClientResponse | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('/api/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    return null;
  }

  return parseInlineCompletionClientResponse(await response.json());
}

export function parseInlineCompletionClientResponse(
  value: unknown,
): InlineCompletionClientResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<InlineCompletionClientResponse>;

  if (typeof candidate.completionText !== 'string' || candidate.source !== 'model') {
    return null;
  }

  return {
    completionText: candidate.completionText,
    source: candidate.source,
  };
}