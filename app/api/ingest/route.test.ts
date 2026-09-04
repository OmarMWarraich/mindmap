import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

mock.module('../../../auth.ts', {
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

test('ingest route reads uploaded image notes with the server env key', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test';

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: [{ type: 'text', text: 'Main Topic: Sociology\n\nSub Topic: Social relationships' }],
      },
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const form = new FormData();
    form.append('files', new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])], 'IMG_0282.jpeg', { type: 'image/jpeg' }));

    const response = await POST(new Request('http://localhost/api/ingest', {
      method: 'POST',
      headers: {
        'x-test-user-id': 'test-user-id',
      },
      body: form,
    }));

    assert.equal(response.status, 200);
    const payload = await response.json() as { text: string; errors: Array<{ fileName: string; message: string }> };
    assert.match(payload.text, /^Main Topic: Sociology/);
    assert.deepEqual(payload.errors, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});
