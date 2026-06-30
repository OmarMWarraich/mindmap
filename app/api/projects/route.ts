import { desc, eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { db } from '@/lib/db/index';
import { projects } from '@/lib/db/schema';
import { describeError, logger } from '@/lib/observability/logger';

export const runtime = 'nodejs';

export const GET = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = req.auth.user.id;

  try {
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));

    return Response.json(userProjects);
  } catch (error) {
    logger.error('failed to list projects', { route: 'GET /api/projects', ...describeError(error) });
    return Response.json({ error: 'Failed to load projects.' }, { status: 500 });
  }
});

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = req.auth.user.id;

  try {
    const body = (await req.json()) as { name?: unknown };
    const name =
      typeof body.name === 'string' && body.name.trim()
        ? body.name.trim()
        : 'Untitled Project';

    const [project] = await db.insert(projects).values({ userId, name }).returning();

    return Response.json(project, { status: 201 });
  } catch (error) {
    logger.error('failed to create project', { route: 'POST /api/projects', ...describeError(error) });
    return Response.json({ error: 'Failed to create project.' }, { status: 500 });
  }
});
