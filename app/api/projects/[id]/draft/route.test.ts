import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://localhost/test';

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

const dbMock = {
  selectQueue: [] as any[][],
  updateReturn: [] as any[],
  insertReturn: [] as any[],
};

mock.module('../../../../../lib/db/index.ts', {
  namedExports: {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(dbMock.selectQueue.shift() ?? []),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => {
            const p = Promise.resolve([]) as any;
            p.returning = () => Promise.resolve(dbMock.updateReturn);
            return p;
          },
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve(dbMock.insertReturn),
        }),
      }),
    },
  },
});

const { GET, PUT } = await import('./route.ts') as unknown as {
  GET: (req: Request, ctx: unknown) => Promise<Response>;
  PUT: (req: Request, ctx: unknown) => Promise<Response>;
};

const PROJECT_ID = 'project-1';

function makeCtx() {
  return { params: Promise.resolve({ id: PROJECT_ID }) };
}

function makeRequest(method: string, userId: string | null, body?: unknown) {
  return new Request(`http://localhost/api/projects/${PROJECT_ID}/draft`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-test-user-id': userId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const sampleProject = { id: PROJECT_ID, userId: 'user-1', name: 'Test Project' };
const sampleDraft = {
  id: 'draft-1',
  projectId: PROJECT_ID,
  outline: '@root: Test',
  rawNotes: '',
  selectedDetailLevel: 'standard',
  mindmap: null,
  previewTransform: null,
  updatedAt: new Date(),
};

test('draft route GET rejects unauthenticated requests', async () => {
  const response = await GET(makeRequest('GET', null), makeCtx());
  assert.equal(response.status, 401);
});

test('draft route GET returns 404 for a project not owned by the requesting user', async () => {
  dbMock.selectQueue = [[]];
  const response = await GET(makeRequest('GET', 'wrong-user'), makeCtx());
  assert.equal(response.status, 404);
});

test('draft route GET returns null when the project has no draft yet', async () => {
  dbMock.selectQueue = [[sampleProject], []];
  const response = await GET(makeRequest('GET', 'user-1'), makeCtx());
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
});

test('draft route GET returns the existing draft', async () => {
  dbMock.selectQueue = [[sampleProject], [sampleDraft]];
  const response = await GET(makeRequest('GET', 'user-1'), makeCtx());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.id, 'draft-1');
  assert.equal(payload.outline, '@root: Test');
});

test('draft route PUT rejects unauthenticated requests', async () => {
  const response = await PUT(makeRequest('PUT', null, { outline: '@root: Test' }), makeCtx());
  assert.equal(response.status, 401);
});

test('draft route PUT returns 404 for a project not owned by the requesting user', async () => {
  dbMock.selectQueue = [[]];
  const response = await PUT(makeRequest('PUT', 'wrong-user', { outline: '@root: Test' }), makeCtx());
  assert.equal(response.status, 404);
});

test('draft route PUT creates a new draft and returns 201 when none exists', async () => {
  const createdDraft = { ...sampleDraft, id: 'draft-new', outline: '@root: New' };
  dbMock.selectQueue = [[sampleProject], []];
  dbMock.insertReturn = [createdDraft];
  const response = await PUT(makeRequest('PUT', 'user-1', { outline: '@root: New' }), makeCtx());
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.id, 'draft-new');
  assert.equal(payload.outline, '@root: New');
});

test('draft route PUT updates an existing draft and returns 200', async () => {
  const updatedDraft = { ...sampleDraft, outline: '@root: Updated' };
  dbMock.selectQueue = [[sampleProject], [sampleDraft]];
  dbMock.updateReturn = [updatedDraft];
  const response = await PUT(makeRequest('PUT', 'user-1', { outline: '@root: Updated' }), makeCtx());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.outline, '@root: Updated');
});
