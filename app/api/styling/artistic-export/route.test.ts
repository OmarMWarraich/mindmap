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

const tinyPngBase64 = Buffer.from('fake-png-bytes').toString('base64');

function exportRequest(body: unknown, userId?: string): Request {
  return new Request('http://localhost/api/styling/artistic-export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-test-user-id': userId } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('artistic export route rejects unauthenticated requests', async () => {
  const response = await POST(exportRequest({ imageDataUrl: `data:image/png;base64,${tinyPngBase64}` }));

  assert.equal(response.status, 401);
});

test('artistic export route rejects invalid request payloads', async () => {
  const response = await POST(exportRequest({ imageDataUrl: 'https://example.com/mindmap.png' }, 'test-user-id'));

  assert.equal(response.status, 400);
});

test('artistic export route returns the stylized image with a disclaimer', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  process.env.OPENAI_API_KEY = 'sk-test';

  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ b64_json: tinyPngBase64 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(exportRequest(
      { imageDataUrl: `data:image/png;base64,${tinyPngBase64}`, mindmapTitle: 'Photosynthesis' },
      'test-user-id',
    ));

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.imageDataUrl, `data:image/png;base64,${tinyPngBase64}`);
    assert.match(payload.disclaimer, /text and fine details may be inaccurate/);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});
