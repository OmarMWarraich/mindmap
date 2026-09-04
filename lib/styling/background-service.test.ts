import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBackgroundImagePrompt,
  generateMindmapBackgroundImage,
  maxBackgroundImageBytes,
} from './background-service.ts';

const testEnv: Record<string, string | undefined> = {
  OPENAI_API_KEY: 'sk-test',
};

const tinyJpegBase64 = Buffer.from('fake-jpeg-bytes').toString('base64');

function imagesResponse(base64: string): Response {
  return new Response(JSON.stringify({ data: [{ b64_json: base64 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('buildBackgroundImagePrompt embeds the style and forbids text in the image', () => {
  const prompt = buildBackgroundImagePrompt('misty forest at dawn', 'Photosynthesis');

  assert.match(prompt, /Style: misty forest at dawn\./);
  assert.match(prompt, /"Photosynthesis"/);
  assert.match(prompt, /no text, letters, numbers/);
});

test('generateMindmapBackgroundImage returns a jpeg data URL and byte size', async () => {
  let requestedUrl = '';
  let requestedBody: Record<string, unknown> = {};

  const response = await generateMindmapBackgroundImage(
    { stylePrompt: 'ocean blues' },
    {
      env: testEnv,
      fetchImpl: async (input, init) => {
        requestedUrl = String(input);
        requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return imagesResponse(tinyJpegBase64);
      },
    },
  );

  assert.equal(requestedUrl, 'https://api.openai.com/v1/images/generations');
  assert.equal(requestedBody.model, 'gpt-image-1');
  assert.equal(requestedBody.output_format, 'jpeg');
  assert.equal(response.imageDataUrl, `data:image/jpeg;base64,${tinyJpegBase64}`);
  assert.equal(response.bytes, Math.floor(tinyJpegBase64.length * 0.75));
});

test('generateMindmapBackgroundImage honors the OPENAI_IMAGE_MODEL_ID override', async () => {
  let requestedModel = '';

  await generateMindmapBackgroundImage(
    { stylePrompt: 'ocean blues' },
    {
      env: { ...testEnv, OPENAI_IMAGE_MODEL_ID: 'gpt-image-2' },
      fetchImpl: async (_input, init) => {
        requestedModel = (JSON.parse(String(init?.body)) as { model: string }).model;
        return imagesResponse(tinyJpegBase64);
      },
    },
  );

  assert.equal(requestedModel, 'gpt-image-2');
});

test('generateMindmapBackgroundImage fails without an OpenAI API key', async () => {
  await assert.rejects(
    async () => generateMindmapBackgroundImage({ stylePrompt: 'ocean blues' }, { env: {} }),
    /requires the OpenAI API key/,
  );
});

test('generateMindmapBackgroundImage surfaces provider errors with status', async () => {
  await assert.rejects(
    async () =>
      generateMindmapBackgroundImage(
        { stylePrompt: 'ocean blues' },
        {
          env: testEnv,
          fetchImpl: async () => new Response('rate limited', { status: 429 }),
        },
      ),
    /failed with 429/,
  );
});

test('generateMindmapBackgroundImage rejects oversized images', async () => {
  const oversizedBase64 = 'A'.repeat(Math.ceil((maxBackgroundImageBytes + 1) / 0.75));

  await assert.rejects(
    async () =>
      generateMindmapBackgroundImage(
        { stylePrompt: 'ocean blues' },
        {
          env: testEnv,
          fetchImpl: async () => imagesResponse(oversizedBase64),
        },
      ),
    /too large to store/,
  );
});

test('generateMindmapBackgroundImage rejects an empty provider payload', async () => {
  await assert.rejects(
    async () =>
      generateMindmapBackgroundImage(
        { stylePrompt: 'ocean blues' },
        {
          env: testEnv,
          fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        },
      ),
    /no image data/,
  );
});
