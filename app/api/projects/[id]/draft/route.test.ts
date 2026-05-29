import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

mock.module('../../../../../auth.ts', {
  namedExports: {
    auth: (handler: Function) => (req: Request, ctx: unknown) => {
      const userId = req.headers.get('x-test-user-id');
      if (userId) {
        (req as any).auth = { user: { id: userId } };
      }
      return handler(req, ctx);
    },
  },
});

const selectQueue: unknown[][] = [];
let mockUpsertResult: Record<string, unknown> = {};

mock.module('../../../../../lib/db/index.ts', {
  namedExports: {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: () => ({
            returning: () => Promise.resolve([{ ...values, ...mockUpsertResult }]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    },
  },
});

const { GET, PUT } = await import('./route.ts') as unknown as {
  GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  PUT: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
};

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

test('GET draft route returns 401 for unauthenticated requests', async () => {
  const response = await GET(
    new Request('http://localhost/api/projects/proj-1/draft'),
    makeCtx('proj-1'),
  );

  assert.equal(response.status, 401);
});

test('GET draft route returns 404 when project belongs to a different user', async () => {
  selectQueue.push([]); // project query returns nothing (wrong owner)

  const response = await GET(
    new Request('http://localhost/api/projects/proj-1/draft', {
      headers: { 'x-test-user-id': 'user-1' },
    }),
    makeCtx('proj-1'),
  );

  assert.equal(response.status, 404);
});

test('GET draft route returns existing draft for authenticated project owner', async () => {
  selectQueue.push([{ id: 'proj-1', userId: 'user-1', name: 'Test', createdAt: new Date(), updatedAt: new Date() }]);
  selectQueue.push([{ id: 'draft-1', projectId: 'proj-1', outline: '@root: Test', rawNotes: '', selectedDetailLevel: 'standard', mindmap: null, previewTransform: null, updatedAt: new Date().toISOString() }]);

  const response = await GET(
    new Request('http://localhost/api/projects/proj-1/draft', {
      headers: { 'x-test-user-id': 'user-1' },
    }),
    makeCtx('proj-1'),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.outline, '@root: Test');
  assert.equal(body.projectId, 'proj-1');
});

test('GET draft route returns null when no draft exists', async () => {
  selectQueue.push([{ id: 'proj-1', userId: 'user-1', name: 'Test', createdAt: new Date(), updatedAt: new Date() }]);
  selectQueue.push([]); // no draft found

  const response = await GET(
    new Request('http://localhost/api/projects/proj-1/draft', {
      headers: { 'x-test-user-id': 'user-1' },
    }),
    makeCtx('proj-1'),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body, null);
});

test('PUT draft route returns 401 for unauthenticated requests', async () => {
  const response = await PUT(
    new Request('http://localhost/api/projects/proj-1/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outline: '@root: Test' }),
    }),
    makeCtx('proj-1'),
  );

  assert.equal(response.status, 401);
});

test('PUT draft route returns 404 when project belongs to a different user', async () => {
  selectQueue.push([]); // project query returns nothing (wrong owner)

  const response = await PUT(
    new Request('http://localhost/api/projects/proj-1/draft', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({ outline: '@root: Test' }),
    }),
    makeCtx('proj-1'),
  );

  assert.equal(response.status, 404);
});

test('PUT draft route upserts draft and returns the saved record', async () => {
  selectQueue.push([{ id: 'proj-1', userId: 'user-1', name: 'Test', createdAt: new Date(), updatedAt: new Date() }]);
  mockUpsertResult = { id: 'draft-1', projectId: 'proj-1', updatedAt: new Date().toISOString() };

  const response = await PUT(
    new Request('http://localhost/api/projects/proj-1/draft', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({
        outline: '@root: Photosynthesis',
        rawNotes: 'some notes',
        selectedDetailLevel: 'detailed',
        mindmap: null,
        previewTransform: { scale: 1, translateX: 0, translateY: 0 },
      }),
    }),
    makeCtx('proj-1'),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.id, 'draft-1');
  assert.equal(body.projectId, 'proj-1');
  assert.equal(body.outline, '@root: Photosynthesis');
});
