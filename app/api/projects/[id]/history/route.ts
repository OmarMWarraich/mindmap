import { and, desc, eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { db } from '@/lib/db/index';
import { generationHistory, projects } from '@/lib/db/schema';
import { describeError, logger } from '@/lib/observability/logger';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = auth(async (req, ctx: RouteContext) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;
  const userId = req.auth.user.id;

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    if (!project) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

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
      ...describeError(error),
    });
    return Response.json({ error: 'Failed to load history.' }, { status: 500 });
  }
});

export const POST = auth(async (req, ctx: RouteContext) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;
  const userId = req.auth.user.id;

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    if (!project) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const [entry] = await db
      .insert(generationHistory)
      .values({
        projectId,
        detailLevel: typeof body.detailLevel === 'string' ? body.detailLevel : 'standard',
        dsl: typeof body.dsl === 'string' ? body.dsl : '',
        densityStatus: typeof body.densityStatus === 'string' ? body.densityStatus : 'target-met',
        nodeCount: typeof body.nodeCount === 'number' ? body.nodeCount : 0,
        rawNotes: typeof body.rawNotes === 'string' ? body.rawNotes : '',
      })
      .returning();

    return Response.json(entry, { status: 201 });
  } catch (error) {
    logger.error('failed to record generation history', {
      route: 'POST /api/projects/[id]/history',
      ...describeError(error),
    });
    return Response.json({ error: 'Failed to record history.' }, { status: 500 });
  }
});
