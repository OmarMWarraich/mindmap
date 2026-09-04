import type { InlineCompletionRequest } from './service.ts';

interface InlineCompletionClientResponse {
  completionText: string;
  source: 'model';
}

export interface InlineCompletionEventRequest {
  correlationId: string;
  outcome: 'accepted' | 'dismissed' | 'ignored';
  outlineLength: number;
  requestReason: string;
  shownDurationMs: number;
  source: 'model';
  suggestionText: string;
}

export async function requestInlineCompletionFromApi(
  request: InlineCompletionRequest,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<InlineCompletionClientResponse | null> {
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
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
  } catch (error) {
    if (isAbortLikeError(error)) {
      return null;
    }

    throw error;
  }
}

function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { name?: unknown; message?: unknown };
  const lowerName = typeof candidate.name === 'string' ? candidate.name.trim().toLowerCase() : '';
  const lowerMessage = typeof candidate.message === 'string' ? candidate.message.trim().toLowerCase() : '';

  return (
    lowerName === 'aborterror' ||
    lowerName === 'canceled' ||
    lowerName === 'cancelled' ||
    lowerMessage.includes('aborted') ||
    lowerMessage.includes('canceled') ||
    lowerMessage.includes('cancelled') ||
    lowerMessage.includes('signal is aborted')
  );
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

export async function trackInlineCompletionEvent(
  event: InlineCompletionEventRequest,
  options: {
    fetchImpl?: typeof fetch;
  } = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;

  await fetchImpl('/api/completion/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
    keepalive: true,
  });
}