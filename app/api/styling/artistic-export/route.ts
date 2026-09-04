import { ZodError } from 'zod';

import { withUser } from '../../../../lib/api/guards.ts';
import { errorResponse } from '../../../../lib/api/responses.ts';
import { describeError, logger } from '../../../../lib/observability/logger.ts';
import {
  artisticExportRequestSchema,
  generateArtisticMindmapExport,
} from '../../../../lib/styling/artistic-export-service.ts';

export const runtime = 'nodejs';

export const POST = withUser(async (req) => {
  try {
    const payload = artisticExportRequestSchema.parse(await req.json());
    const response = await generateArtisticMindmapExport(payload);

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected artistic export route failure.';
    const status = error instanceof ZodError ? 400 : 500;

    if (status >= 500) {
      logger.error('artistic export request failed', {
        route: 'POST /api/styling/artistic-export',
        status,
        ...describeError(error),
      });
    }

    return errorResponse(message, status);
  }
});
