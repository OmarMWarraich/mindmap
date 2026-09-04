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
const { defaultMindmapTheme } = await import('../../../../lib/mindmap/theme.ts');

function themeRequest(body: unknown, userId?: string): Request {
  return new Request('http://localhost/api/styling/theme', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-test-user-id': userId } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('theme route rejects unauthenticated requests', async () => {
  const response = await POST(themeRequest({ stylePrompt: 'forest tones' }));

  assert.equal(response.status, 401);
});

test('theme route rejects invalid request payloads', async () => {
  const response = await POST(themeRequest({ stylePrompt: 12 }, 'test-user-id'));

  assert.equal(response.status, 400);
});

test('theme route returns a validated theme for a valid request', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  delete process.env.OPENAI_API_KEY;

  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({
      ...defaultMindmapTheme,
      name: 'Ocean',
      background: { kind: 'solid', color: '#0c4a6e' },
    }) }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await POST(themeRequest({ stylePrompt: 'ocean blues' }, 'test-user-id'));

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.theme.name, 'Ocean');
    assert.equal(payload.theme.background.kind, 'solid');
    assert.equal(payload.quality.mode, 'first-pass');
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});
