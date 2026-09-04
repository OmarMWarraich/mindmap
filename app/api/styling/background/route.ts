import { ZodError } from 'zod';

import { withUser } from '../../../../lib/api/guards.ts';
import { errorResponse } from '../../../../lib/api/responses.ts';
import { describeError, logger } from '../../../../lib/observability/logger.ts';
import {
  generateMindmapBackgroundImage,
  mindmapBackgroundGenerationRequestSchema,
} from '../../../../lib/styling/background-service.ts';

export const runtime = 'nodejs';

export const POST = withUser(async (req) => {
  try {
    const payload = mindmapBackgroundGenerationRequestSchema.parse(await req.json());
    const response = await generateMindmapBackgroundImage(payload);

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected background generation route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    if (status >= 500) {
      logger.error('background image generation request failed', {
        route: 'POST /api/styling/background',
        status,
        ...describeError(error),
      });
    }

    return errorResponse(message, status);
  }
});
