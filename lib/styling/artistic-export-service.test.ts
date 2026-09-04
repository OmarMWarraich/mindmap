import assert from 'node:assert/strict';
import test from 'node:test';

import {
  artisticExportDisclaimer,
  buildArtisticExportPrompt,
  generateArtisticMindmapExport,
} from './artistic-export-service.ts';

const testEnv: Record<string, string | undefined> = {
  OPENAI_API_KEY: 'sk-test',
};

const tinyPngBase64 = Buffer.from('fake-png-bytes').toString('base64');
const inputImageDataUrl = `data:image/png;base64,${tinyPngBase64}`;

function editsResponse(base64: string): Response {
  return new Response(JSON.stringify({ data: [{ b64_json: base64 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('buildArtisticExportPrompt keeps layout fidelity and applies art direction', () => {
  const prompt = buildArtisticExportPrompt('misty forest', 'Photosynthesis');

  assert.match(prompt, /Keep the exact node layout/);
  assert.match(prompt, /"Photosynthesis"/);
  assert.match(prompt, /Art direction: misty forest\./);
});

test('buildArtisticExportPrompt falls back to a default art direction', () => {
  const prompt = buildArtisticExportPrompt();

  assert.match(prompt, /Art direction: warm, atmospheric/);
});

test('generateArtisticMindmapExport posts multipart form data to the edits endpoint', async () => {
  let requestedUrl = '';
  let requestedForm: unknown;

  const response = await generateArtisticMindmapExport(
    { imageDataUrl: inputImageDataUrl, stylePrompt: 'oil painting' },
    {
      env: testEnv,
      fetchImpl: async (input, init) => {
        requestedUrl = String(input);
        requestedForm = init?.body;
        return editsResponse(tinyPngBase64);
      },
    },
  );

  assert.equal(requestedUrl, 'https://api.openai.com/v1/images/edits');
  assert.ok(requestedForm instanceof FormData);
  assert.equal(requestedForm.get('model'), 'gpt-image-1');
  assert.match(String(requestedForm.get('prompt')), /oil painting/);
  assert.ok(requestedForm.get('image') instanceof Blob);
  assert.equal(response.imageDataUrl, `data:image/png;base64,${tinyPngBase64}`);
  assert.equal(response.disclaimer, artisticExportDisclaimer);
});

test('generateArtisticMindmapExport fails without an OpenAI API key', async () => {
  await assert.rejects(
    async () => generateArtisticMindmapExport({ imageDataUrl: inputImageDataUrl }, { env: {} }),
    /requires the OpenAI API key/,
  );
});

test('generateArtisticMindmapExport rejects non-image data URLs', async () => {
  await assert.rejects(
    async () =>
      generateArtisticMindmapExport(
        { imageDataUrl: 'data:text/plain;base64,abc' },
        { env: testEnv, fetchImpl: async () => editsResponse(tinyPngBase64) },
      ),
  );
});

test('generateArtisticMindmapExport surfaces provider errors with status', async () => {
  await assert.rejects(
    async () =>
      generateArtisticMindmapExport(
        { imageDataUrl: inputImageDataUrl },
        {
          env: testEnv,
          fetchImpl: async () => new Response('bad request', { status: 400 }),
        },
      ),
    /failed with 400/,
  );
});

test('generateArtisticMindmapExport rejects an empty provider payload', async () => {
  await assert.rejects(
    async () =>
      generateArtisticMindmapExport(
        { imageDataUrl: inputImageDataUrl },
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
