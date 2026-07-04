import { and, eq } from 'drizzle-orm';
import type { NextAuthRequest } from 'next-auth';

import { db } from '../db/index.ts';
import { projects, type Project } from '../db/schema.ts';
import { withUser } from './guards.ts';
import { notFound } from './responses.ts';

/** The owned project plus the resolved ids, handed to an authorized handler. */
export interface ProjectScope {
  userId: string;
  projectId: string;
  project: Project;
}

export type AuthorizedProjectHandler = (
  req: NextAuthRequest,
  scope: ProjectScope,
) => Response | Promise<Response>;

/**
 * Load a project only if it belongs to the given user. The ownership predicate
 * (`id` AND `userId`) lives here once, so it cannot drift or be forgotten by a
 * new route — the source of the latent tenant-isolation risk.
 */
export async function loadOwnedProject(
  userId: string,
  projectId: string,
): Promise<Project | undefined> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  return project;
}

/**
 * Wrap a `/projects/[id]/*` handler so it only runs for the authenticated owner
 * of an existing project. Unauthenticated → 401; missing or not-owned → 404. The
 * handler receives the already-authorized project, so it can never accidentally
 * skip the ownership check.
 */
export function withProject(handler: AuthorizedProjectHandler) {
  return withUser(async (req, userId, ctx) => {
    const { id: projectId } = await ctx.params;
    const project = await loadOwnedProject(userId, projectId);

    if (!project) {
      return notFound();
    }

    return handler(req, { userId, projectId, project });
  });
}
