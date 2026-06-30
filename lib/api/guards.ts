import { and, eq } from 'drizzle-orm';
import type { NextAuthRequest } from 'next-auth';

import { auth } from '../../auth.ts';
import { db } from '../db/index.ts';
import { projects, type Project } from '../db/schema.ts';
import { notFound, unauthorized } from './responses.ts';

// Next.js passes a context object whose `params` resolves to the dynamic route
// segments. We only read `id` for project routes; keep it permissive otherwise.
type RouteContext = { params: Promise<Record<string, string>> };

export type AuthenticatedRouteHandler = (
  req: NextAuthRequest,
  userId: string,
  ctx: RouteContext,
) => Response | Promise<Response>;

/**
 * Wrap an App Router handler so it only runs for an authenticated user, with the
 * user id guaranteed non-null. Unauthenticated requests get a single, shared 401.
 * This replaces the `if (!req.auth?.user?.id) return 401` block copy-pasted into
 * every route.
 */
export function withUser(handler: AuthenticatedRouteHandler) {
  return auth((req, ctx) => {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return unauthorized();
    }

    return handler(req, userId, ctx);
  });
}

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
