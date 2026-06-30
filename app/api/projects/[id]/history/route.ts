import { desc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { withProject } from '../../../../../lib/api/guards.ts';
import { historyCreateSchema } from '../../../../../lib/api/projects-schema.ts';
import { errorResponse } from '../../../../../lib/api/responses.ts';
import { db } from '../../../../../lib/db/index.ts';
import { generationHistory } from '../../../../../lib/db/schema.ts';
import { describeError, logger } from '../../../../../lib/observability/logger.ts';

export const runtime = 'nodejs';

export const GET = withProject(async (_req, { projectId }) => {
  try {
    const history = await db
      .select()
      .from(generationHistory)
      .where(eq(generationHistory.projectId, projectId))
      .orderBy(desc(generationHistory.createdAt))
      .limit(20);

    return Response.json(history);
  } catch (error) {
    logger.error('failed to load generation history', {
      route: 'GET /api/projects/[id]/history',
      status: 500,
      ...describeError(error),
    });
    return errorResponse('Failed to load history.', 500);
  }
});

export const POST = withProject(async (req, { projectId }) => {
  try {
    const body = historyCreateSchema.parse(await req.json());

    const [entry] = await db
      .insert(generationHistory)
      .values({
        projectId,
        detailLevel: body.detailLevel,
        dsl: body.dsl,
        densityStatus: body.densityStatus,
        nodeCount: body.nodeCount,
        rawNotes: body.rawNotes,
      })
      .returning();

    return Response.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(error.message, 400);
    }

    logger.error('failed to record generation history', {
      route: 'POST /api/projects/[id]/history',
      status: 500,
      ...describeError(error),
    });
    return errorResponse('Failed to record history.', 500);
  }
});
