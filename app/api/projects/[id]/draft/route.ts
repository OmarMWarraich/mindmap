import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { withProject } from '../../../../../lib/api/project-guard.ts';
import { draftUpdateSchema } from '../../../../../lib/api/projects-schema.ts';
import { errorResponse } from '../../../../../lib/api/responses.ts';
import { db } from '../../../../../lib/db/index.ts';
import { projectDrafts, projects } from '../../../../../lib/db/schema.ts';
import { describeError, logger } from '../../../../../lib/observability/logger.ts';

export const runtime = 'nodejs';

export const GET = withProject(async (_req, { projectId }) => {
  try {
    const [draft] = await db
      .select()
      .from(projectDrafts)
      .where(eq(projectDrafts.projectId, projectId));

    return Response.json(draft ?? null);
  } catch (error) {
    logger.error('failed to load project draft', {
      route: 'GET /api/projects/[id]/draft',
      status: 500,
      ...describeError(error),
    });
    return errorResponse('Failed to load draft.', 500);
  }
});

export const PUT = withProject(async (req, { projectId }) => {
  try {
    const body = draftUpdateSchema.parse(await req.json());

    const [existing] = await db
      .select()
      .from(projectDrafts)
      .where(eq(projectDrafts.projectId, projectId));

    const now = new Date();

    if (existing) {
      const [updated] = await db
        .update(projectDrafts)
        .set({
          outline: body.outline ?? existing.outline,
          rawNotes: body.rawNotes ?? existing.rawNotes,
          selectedDetailLevel: body.selectedDetailLevel ?? existing.selectedDetailLevel,
          mindmap: body.mindmap !== undefined ? body.mindmap : existing.mindmap,
          previewTransform:
            body.previewTransform !== undefined ? body.previewTransform : existing.previewTransform,
          nodePositionOverrides:
            body.nodePositionOverrides !== undefined
              ? body.nodePositionOverrides
              : existing.nodePositionOverrides,
          updatedAt: now,
        })
        .where(eq(projectDrafts.id, existing.id))
        .returning();

      await db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));

      return Response.json(updated);
    }

    const [created] = await db
      .insert(projectDrafts)
      .values({
        projectId,
        outline: body.outline ?? '',
        rawNotes: body.rawNotes ?? '',
        selectedDetailLevel: body.selectedDetailLevel ?? 'standard',
        mindmap: body.mindmap ?? null,
        previewTransform: body.previewTransform ?? null,
        nodePositionOverrides: body.nodePositionOverrides ?? null,
      })
      .returning();

    await db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));

    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(error.message, 400);
    }

    logger.error('failed to save project draft', {
      route: 'PUT /api/projects/[id]/draft',
      status: 500,
      ...describeError(error),
    });
    return errorResponse('Failed to save draft.', 500);
  }
});
