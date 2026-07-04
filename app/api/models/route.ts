import { withUser } from '../../../lib/api/guards.ts';
import { errorResponse } from '../../../lib/api/responses.ts';
import { modelRoleSchema } from '../../../lib/model/catalog.ts';
import { listPublicModels } from '../../../lib/model/public-catalog.ts';

export const runtime = 'nodejs';

// Returns the model catalog filtered to providers the server can actually call
// and the ops allow-list, projected to non-secret fields. Drives the client
// dropdown without hardcoding the list or exposing keys/base URLs. Pass
// `?role=completion` or `?role=generation` to scope the list to one selector.
export const GET = withUser(async (req) => {
  const roleParam = new URL(req.url).searchParams.get('role');

  if (roleParam !== null) {
    const parsedRole = modelRoleSchema.safeParse(roleParam);

    if (!parsedRole.success) {
      return errorResponse(`Invalid role: ${roleParam}`, 400);
    }

    return Response.json({ models: listPublicModels({ role: parsedRole.data }) });
  }

  return Response.json({ models: listPublicModels() });
});
