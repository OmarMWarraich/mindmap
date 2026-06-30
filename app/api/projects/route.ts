import { desc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { withUser } from '../../../lib/api/guards.ts';
import { createProjectSchema } from '../../../lib/api/projects-schema.ts';
import { errorResponse } from '../../../lib/api/responses.ts';
import { db } from '../../../lib/db/index.ts';
import { projects } from '../../../lib/db/schema.ts';
import { describeError, logger } from '../../../lib/observability/logger.ts';

export const runtime = 'nodejs';

export const GET = withUser(async (_req, userId) => {
  try {
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));

    return Response.json(userProjects);
  } catch (error) {
    logger.error('failed to list projects', { route: 'GET /api/projects', status: 500, ...describeError(error) });
    return errorResponse('Failed to load projects.', 500);
  }
});

export const POST = withUser(async (req, userId) => {
  try {
    const { name: rawName } = createProjectSchema.parse(await req.json());
    const name = rawName && rawName.trim() ? rawName.trim() : 'Untitled Project';

    const [project] = await db.insert(projects).values({ userId, name }).returning();

    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(error.message, 400);
    }

    logger.error('failed to create project', { route: 'POST /api/projects', status: 500, ...describeError(error) });
    return errorResponse('Failed to create project.', 500);
  }
});
