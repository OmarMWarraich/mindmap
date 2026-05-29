import { and, eq } from 'drizzle-orm';

import { auth } from '../../../../../auth.ts';
import { db } from '../../../../../lib/db/index.ts';
import { projectDrafts, projects } from '../../../../../lib/db/schema.ts';

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

  const draftValues = {
    outline: typeof body.outline === 'string' ? body.outline : '',
    rawNotes: typeof body.rawNotes === 'string' ? body.rawNotes : '',
    selectedDetailLevel:
      typeof body.selectedDetailLevel === 'string' ? body.selectedDetailLevel : 'standard',
    mindmap: body.mindmap !== undefined ? (body.mindmap as unknown) : null,
    previewTransform:
      body.previewTransform !== undefined ? (body.previewTransform as unknown) : null,
  };

  const now = new Date();

  const [upserted] = await db
    .insert(projectDrafts)
    .values({ projectId, ...draftValues })
    .onConflictDoUpdate({
      target: projectDrafts.projectId,
      set: { ...draftValues, updatedAt: now },
    })
    .returning();

  await db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));

  return Response.json(upserted);
});
