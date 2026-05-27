import { and, eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { db } from '@/lib/db/index';
import { projectDrafts, projects } from '@/lib/db/schema';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = auth(async (req, ctx: RouteContext) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;
  const userId = req.auth.user.id;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const [draft] = await db
    .select()
    .from(projectDrafts)
    .where(eq(projectDrafts.projectId, projectId));

  return Response.json(draft ?? null);
});

export const PUT = auth(async (req, ctx: RouteContext) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;
  const userId = req.auth.user.id;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  const [existing] = await db
    .select()
    .from(projectDrafts)
    .where(eq(projectDrafts.projectId, projectId));

  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(projectDrafts)
      .set({
        outline: typeof body.outline === 'string' ? body.outline : existing.outline,
        rawNotes: typeof body.rawNotes === 'string' ? body.rawNotes : existing.rawNotes,
        selectedDetailLevel:
          typeof body.selectedDetailLevel === 'string'
            ? body.selectedDetailLevel
            : existing.selectedDetailLevel,
        mindmap: body.mindmap !== undefined ? body.mindmap : existing.mindmap,
        previewTransform:
          body.previewTransform !== undefined
            ? body.previewTransform
            : existing.previewTransform,
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
      outline: typeof body.outline === 'string' ? body.outline : '',
      rawNotes: typeof body.rawNotes === 'string' ? body.rawNotes : '',
      selectedDetailLevel:
        typeof body.selectedDetailLevel === 'string' ? body.selectedDetailLevel : 'standard',
      mindmap: body.mindmap ?? null,
      previewTransform: body.previewTransform ?? null,
    })
    .returning();

  await db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));

  return Response.json(created, { status: 201 });
});
