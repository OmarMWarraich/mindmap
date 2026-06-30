import type { NextAuthRequest } from 'next-auth';

import { auth } from '../../auth.ts';
import { unauthorized } from './responses.ts';

// Next.js passes a context object whose `params` resolves to the dynamic route
// segments. We only read `id` for project routes; keep it permissive otherwise.
export type RouteContext = { params: Promise<Record<string, string>> };

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
 *
 * Intentionally has no database dependency, so auth-only routes (completion,
 * generation, models) do not transitively import the persistence layer.
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
