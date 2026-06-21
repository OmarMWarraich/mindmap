import { auth } from '../../../auth.ts';
import { modelRoleSchema } from '../../../lib/model/catalog.ts';
import { listPublicModels } from '../../../lib/model/public-catalog.ts';

export const runtime = 'nodejs';

// Returns the model catalog filtered to providers the server can actually call
// and the ops allow-list, projected to non-secret fields. Drives the client
// dropdown without hardcoding the list or exposing keys/base URLs. Pass
// `?role=completion` or `?role=generation` to scope the list to one selector.
export const GET = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleParam = new URL(req.url).searchParams.get('role');

  if (roleParam !== null) {
    const parsedRole = modelRoleSchema.safeParse(roleParam);

    if (!parsedRole.success) {
      return Response.json({ error: `Invalid role: ${roleParam}` }, { status: 400 });
    }

    return Response.json({ models: listPublicModels({ role: parsedRole.data }) });
  }

  return Response.json({ models: listPublicModels() });
});
