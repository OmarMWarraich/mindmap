import assert from 'node:assert/strict';
import test from 'node:test';

import sharp from 'sharp';

import { createImageIngestionAdapter } from './image-adapter.ts';

async function makeRealJpegFile(name: string): Promise<File> {
  const bytes = await sharp({
    create: { width: 120, height: 80, channels: 3, background: { r: 255, g: 250, b: 240 } },
  }).jpeg().toBuffer();
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });
}

function visionResponse(text: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: [{ type: 'text', text }] } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function decodePayloadImage(init: RequestInit | undefined): Buffer {
  const body = JSON.parse(String(init?.body ?? '{}'));
  const url: string = body.messages?.[0]?.content?.find((p: { type?: string }) => p.type === 'image_url')?.image_url?.url ?? '';
  return Buffer.from(url.split(',')[1] ?? '', 'base64');
}

test('vision extraction retries with rotated copies when the first pass returns no text', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  const attemptedDimensions: Array<{ width?: number; height?: number }> = [];
  let callCount = 0;
  globalThis.fetch = async (_url, init) => {
    callCount += 1;
    const meta = await sharp(decodePayloadImage(init)).metadata();
    attemptedDimensions.push({ width: meta.width, height: meta.height });
    // First orientation unreadable, second (rotated) readable.
    return visionResponse(callCount === 1 ? '' : 'Main Topic: Criminal Law\n\nSub Topic: Mens Rea');
  };

  try {
    const adapter = createImageIngestionAdapter();
    const result = await adapter.read(await makeRealJpegFile('IMG_0295.jpg'));

    assert.match(result.text, /^Main Topic: Criminal Law/);
    assert.equal(callCount, 2, 'expected one original attempt plus one rotated retry');
    assert.deepEqual(attemptedDimensions[0], { width: 120, height: 80 });
    assert.deepEqual(attemptedDimensions[1], { width: 80, height: 120 }, 'retry must send the 90°-rotated image');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('vision extraction treats refusal-style replies as unreadable and retries rotated', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return visionResponse(callCount === 1
      ? "I'm unable to read the text in this image."
      : 'Main Topic: Criminal Law');
  };

  try {
    const adapter = createImageIngestionAdapter();
    const result = await adapter.read(await makeRealJpegFile('IMG_0298.jpg'));

    assert.match(result.text, /^Main Topic: Criminal Law/);
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('vision extraction reports a clear error only after all rotations fail', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return visionResponse('');
  };

  try {
    const adapter = createImageIngestionAdapter();
    await assert.rejects(
      adapter.read(await makeRealJpegFile('IMG_0001.jpg')),
      /even after rotating/,
    );
    assert.equal(callCount, 4, 'expected original + three rotated attempts');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});
