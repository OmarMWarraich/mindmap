import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

mock.module('../../../../auth.ts', {
  namedExports: {
    auth: (handler: (req: Request) => unknown) => (req: Request) => {
      const userId = req.headers.get('x-test-user-id');
      if (userId) {
        (req as Request & { auth?: unknown }).auth = { user: { id: userId } };
      }
      return handler(req);
    },
  },
});

const { POST } = await import('./route.ts') as unknown as { POST: (req: Request) => Promise<Response> };

function backgroundRequest(body: unknown, userId?: string): Request {
  return new Request('http://localhost/api/styling/background', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-test-user-id': userId } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('background route rejects unauthenticated requests', async () => {
  const response = await POST(backgroundRequest({ stylePrompt: 'forest tones' }));

  assert.equal(response.status, 401);
});

test('background route rejects invalid request payloads', async () => {
  const response = await POST(backgroundRequest({ stylePrompt: 12 }, 'test-user-id'));

  assert.equal(response.status, 400);
});

test('background route returns a data URL for a valid request', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const base64 = Buffer.from('fake-jpeg-bytes').toString('base64');

  process.env.OPENAI_API_KEY = 'sk-test';

  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ b64_json: base64 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(backgroundRequest({ stylePrompt: 'misty forest' }, 'test-user-id'));

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.imageDataUrl, `data:image/jpeg;base64,${base64}`);
    assert.equal(payload.bytes > 0, true);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});
