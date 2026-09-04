import { ZodError } from 'zod';

import { withUser } from '../../../../lib/api/guards.ts';
import { errorResponse } from '../../../../lib/api/responses.ts';
import { authorizeModelId } from '../../../../lib/model/authorization.ts';
import { describeError, logger } from '../../../../lib/observability/logger.ts';
import {
  generateMindmapThemeFromPrompt,
  mindmapThemeGenerationRequestSchema,
} from '../../../../lib/styling/theme-service.ts';

export const runtime = 'nodejs';

export const POST = withUser(async (req) => {
  try {
    const payload = mindmapThemeGenerationRequestSchema.parse(await req.json());

    if (payload.modelId) {
      const authorization = authorizeModelId(payload.modelId, { role: 'generation' });

      if (!authorization.ok) {
        return errorResponse(authorization.reason, authorization.status);
      }
    }

    const response = await generateMindmapThemeFromPrompt(payload);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected theme generation route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    if (status >= 500) {
      logger.error('theme generation request failed', {
        route: 'POST /api/styling/theme',
        status,
        ...describeError(error),
      });
    }

    return errorResponse(message, status);
  }
});
