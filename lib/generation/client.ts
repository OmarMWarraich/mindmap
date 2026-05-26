import type {
  SourceMindmapGenerationRequest,
  SourceMindmapGenerationResponse,
} from './source-schema.ts';
import { sourceMindmapGenerationResponseSchema } from './source-schema.ts';

interface SourceMindmapGenerationErrorResponse {
  error?: string;
}

export async function requestMindmapDslGenerationFromApi(
  request: SourceMindmapGenerationRequest,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<SourceMindmapGenerationResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('/api/generation/dsl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload.error ?? `Mindmap generation failed with status ${response.status}.`);
  }

  return parseSourceMindmapGenerationClientResponse(await response.json());
}

export function parseSourceMindmapGenerationClientResponse(
  value: unknown,
): SourceMindmapGenerationResponse {
  const parsedResponse = sourceMindmapGenerationResponseSchema.safeParse(value);

  if (!parsedResponse.success) {
    throw new Error('Mindmap generation returned an invalid response payload.');
  }

  return parsedResponse.data;
}

async function parseErrorPayload(response: Response): Promise<SourceMindmapGenerationErrorResponse> {
  try {
    return await response.json() as SourceMindmapGenerationErrorResponse;
  } catch {
    return {};
  }
}