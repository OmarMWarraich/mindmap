import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// withUser composes NextAuth's auth() wrapper; mock it to control req.auth.
type MockHandler = (req: Request, ctx: unknown) => unknown;

mock.module('../../auth.ts', {
  namedExports: {
    auth: (handler: MockHandler) => (req: Request, ctx: unknown) => {
      const userId = req.headers.get('x-test-user-id');
      if (userId) {
        (req as Request & { auth?: { user: { id: string } } }).auth = { user: { id: userId } };
      }
      return handler(req, ctx);
    },
  },
});

const { withUser } = (await import('./guards.ts')) as unknown as {
  withUser: (handler: (req: Request, userId: string, ctx: unknown) => Promise<Response>) =>
    (req: Request, ctx: unknown) => Promise<Response>;
};

function request(userId: string | null): Request {
  return new Request('http://localhost/api/x', {
    headers: userId ? { 'x-test-user-id': userId } : {},
  });
}

test('withUser returns a shared 401 when there is no authenticated user', async () => {
  let ran = false;
  const handler = withUser(async () => {
    ran = true;
    return Response.json({ ok: true });
  });

  const res = await handler(request(null), {});

  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Unauthorized' });
  assert.equal(ran, false);
});

test('withUser invokes the handler with the guaranteed user id', async () => {
  let seen: string | undefined;
  const handler = withUser(async (_req, userId) => {
    seen = userId;
    return Response.json({ userId });
  });

  const res = await handler(request('user-42'), {});

  assert.equal(res.status, 200);
  assert.equal(seen, 'user-42');
  assert.deepEqual(await res.json(), { userId: 'user-42' });
});
