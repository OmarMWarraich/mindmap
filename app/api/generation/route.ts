import { ZodError } from 'zod';

import { withUser } from '../../../lib/api/guards.ts';
import { errorResponse } from '../../../lib/api/responses.ts';
import { generateMindmapOverlay, generationRequestSchema } from '../../../lib/generation/service.ts';
import { authorizeModelId } from '../../../lib/model/authorization.ts';
import { describeError, logger } from '../../../lib/observability/logger.ts';

export const runtime = 'nodejs';

export const POST = withUser(async (req) => {
  try {
    const payload = generationRequestSchema.parse(await req.json());

    if (payload.modelId) {
      const authorization = authorizeModelId(payload.modelId, { role: 'generation' });

      if (!authorization.ok) {
        return errorResponse(authorization.reason, authorization.status);
      }
    }

    const response = await generateMindmapOverlay(payload);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected generation route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    if (status >= 500) {
      logger.error('mindmap generation request failed', {
        route: 'POST /api/generation',
        status,
        ...describeError(error),
      });
    }

    return errorResponse(message, status);
  }
});