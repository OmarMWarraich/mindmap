import { ZodError } from 'zod';

import { auth } from '../../../../auth.ts';
import {
  generateMindmapDslFromSource,
  sourceMindmapGenerationRequestSchema,
} from '../../../../lib/generation/source-service.ts';
import { authorizeModelId } from '../../../../lib/model/authorization.ts';
import { describeError, logger } from '../../../../lib/observability/logger.ts';

export const runtime = 'nodejs';

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = sourceMindmapGenerationRequestSchema.parse(await req.json());

    if (payload.modelId) {
      const authorization = authorizeModelId(payload.modelId, { role: 'generation' });

      if (!authorization.ok) {
        return Response.json({ error: authorization.reason }, { status: authorization.status });
      }
    }

    const response = await generateMindmapDslFromSource(payload);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected source generation route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    if (status >= 500) {
      logger.error('source-to-DSL generation request failed', {
        route: 'POST /api/generation/dsl',
        status,
        ...describeError(error),
      });
    }

    return Response.json({ error: message }, { status });
  }
});