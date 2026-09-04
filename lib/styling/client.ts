import type {
  MindmapBackgroundGenerationRequest,
  MindmapBackgroundGenerationResponse,
} from './background-service.ts';
import { mindmapBackgroundGenerationResponseSchema } from './background-service.ts';
import type {
  MindmapThemeGenerationRequest,
  MindmapThemeGenerationResponse,
} from './theme-service.ts';
import { mindmapThemeGenerationResponseSchema } from './theme-service.ts';

interface ThemeGenerationErrorResponse {
  error?: string;
}

export async function requestMindmapThemeFromApi(
  request: MindmapThemeGenerationRequest,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<MindmapThemeGenerationResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('/api/styling/theme', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload.error ?? `Theme generation failed with status ${response.status}.`);
  }

  const parsed = mindmapThemeGenerationResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error('Theme generation returned an invalid response payload.');
  }

  return parsed.data;
}

async function parseErrorPayload(response: Response): Promise<ThemeGenerationErrorResponse> {
  try {
    return await response.json() as ThemeGenerationErrorResponse;
  } catch {
    return {};
  }
}

export async function requestMindmapBackgroundFromApi(
  request: MindmapBackgroundGenerationRequest,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<MindmapBackgroundGenerationResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('/api/styling/background', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload.error ?? `Background generation failed with status ${response.status}.`);
  }

  const parsed = mindmapBackgroundGenerationResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error('Background generation returned an invalid response payload.');
  }

  return parsed.data;
}
