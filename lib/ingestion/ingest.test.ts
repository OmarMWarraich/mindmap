import assert from 'node:assert/strict';
import test from 'node:test';

import { maxSourceTextCharacters } from '../generation/limits.ts';
import { acceptedIngestionExtensions as clientAcceptedExtensions } from './accepted-extensions.ts';
import { createImageIngestionAdapter } from './image-adapter.ts';
import { acceptedIngestionExtensions, ingestFile, ingestFiles } from './ingest.ts';
import { convertNormalizedTextSourceNotesFormat, normalizeOCTText } from './ocr-normalizer.ts';
import { IngestionError } from './types.ts';

function pngSignatureBytes(): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
}

function jpegSignatureBytes(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

function makeImageFile(name: string, type: string, signature: Uint8Array): File {
  return new File([signature], name, { type });
}

function makeFile(name: string, content: string, type = ''): File {
  return new File([content], name, { type });
}

test('ingestFile reads a .txt file into text with metadata', async () => {
  const result = await ingestFile(makeFile('notes.txt', 'hello world', 'text/plain'));

  assert.equal(result.text, 'hello world');
  assert.equal(result.meta.fileName, 'notes.txt');
  assert.equal(result.meta.mimeType, 'text/plain');
  assert.ok(result.meta.sizeBytes > 0);
});

test('ingestFile reads a .md file even when the browser reports no MIME type', async () => {
  const markdown = '# Title\n\n- point one\n- point two';
  const result = await ingestFile(makeFile('outline.md', markdown, ''));

  // Markdown is preserved verbatim (not stripped).
  assert.equal(result.text, markdown);
  assert.equal(result.meta.fileName, 'outline.md');
});

test('ingestFile reads a PNG image with OCR-backed text extraction when the file adapter is configured', async () => {
  const adapter = createImageIngestionAdapter({
    textExtractor: async () => 'Lecture notes\n\nPhotosynthesis and respiration',
  });
  const result = await adapter.read(makeImageFile('photo.png', 'image/png', pngSignatureBytes()));

  assert.equal(result.text, 'Lecture notes\n\nPhotosynthesis and respiration');
  assert.equal(result.meta.fileName, 'photo.png');
  assert.equal(result.meta.mimeType, 'image/png');
});

test('image ingestion prefers the LLM vision route before falling back to OCR', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({ text: 'Main Topic: Sociology\n\nSub Topic: Social relationships' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const adapter = createImageIngestionAdapter();
    const result = await adapter.read(makeImageFile('photo.png', 'image/png', pngSignatureBytes()));

    assert.equal(result.text, 'Main Topic: Sociology\n\nSub Topic: Social relationships');
    assert.equal(result.meta.fileName, 'photo.png');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('image ingestion requires an OpenAI key before using the vision path', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const adapter = createImageIngestionAdapter();
    await assert.rejects(
      adapter.read(makeImageFile('photo.png', 'image/png', pngSignatureBytes())),
      (error) => error instanceof IngestionError && /OPENAI_API_KEY/.test(error.message),
    );
  } finally {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('ingestFile rejects a renamed binary file even when the extension matches', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  try {
    const file = new File(['not really png'], 'photo.png', { type: 'application/octet-stream' });

    await assert.rejects(
      ingestFile(file),
      (error) => error instanceof IngestionError && /not a valid image|invalid image/.test(error.message),
    );
  } finally {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('image ingestion normalizes noisy vision output into Source Notes format', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: [
          { type: 'text', text: [
            ': 21',
            'i ntroduction 10 Sociology',
            ': O SOCIOLOG £2',
            'oy 301 : INTRODUCTION x me :',
            'E30 1. Introductory Words iol ones',
            '2 rea an society, Te Sines',
            'sociology is the scientific study of human society,',
            'social relationships, and group behaviour.',
            'Auguste Comte',
            'According to Comte, sociology is the scientific study of society.',
            'Emile Durkheim',
            'Durkheim defined sociology as the study of social facts.',
          ].join('\n') },
        ],
      },
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const adapter = createImageIngestionAdapter();
    const result = await adapter.read(makeImageFile('photo.png', 'image/png', pngSignatureBytes()));

    assert.match(result.text, /^Main Topic: Introduction to Sociology/);
    assert.match(result.text, /Sub Topic: Concept of Sociology/);
    assert.match(result.text, /Sub sub Topic: Auguste Comte/);
    assert.match(result.text, /Examples:/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('image ingestion reads nested output_text payloads from the latest OpenAI response shape', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    output: [{
      type: 'message',
      content: [{
        type: 'output_text',
        text: [{
          type: 'text',
          text: 'Main Topic: Biology\n\nSub Topic: Photosynthesis',
        }],
      }],
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const adapter = createImageIngestionAdapter();
    const result = await adapter.read(makeImageFile('photo.png', 'image/png', pngSignatureBytes()));

    assert.match(result.text, /^Main Topic: Biology/);
    assert.match(result.text, /Sub Topic: Photosynthesis/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('ingestFile rejects an empty file', async () => {
  await assert.rejects(
    ingestFile(makeFile('blank.txt', '   \n  ', 'text/plain')),
    (error) => error instanceof IngestionError && /appears to be empty/.test(error.message),
  );
});

test('ingestFile rejects text beyond the generation character cap', async () => {
  const tooLong = 'a'.repeat(maxSourceTextCharacters + 1);

  await assert.rejects(
    ingestFile(makeFile('huge.txt', tooLong, 'text/plain')),
    (error) => error instanceof IngestionError && /too much text/.test(error.message),
  );
});

test('ingestFiles concatenates successful files and collects per-file errors', async () => {
  const result = await ingestFiles([
    makeFile('a.txt', 'first', 'text/plain'),
    makeFile('bad.svg', 'binary', 'image/svg+xml'),
    makeFile('b.md', 'second', ''),
  ]);

  assert.equal(result.text, 'first\n\nsecond');
  assert.equal(result.ingested.length, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.fileName, 'bad.svg');
});

test('acceptedIngestionExtensions advertises common text and image formats', () => {
  assert.ok(acceptedIngestionExtensions.includes('txt'));
  assert.ok(acceptedIngestionExtensions.includes('md'));
  assert.ok(acceptedIngestionExtensions.includes('pdf'));
  assert.ok(acceptedIngestionExtensions.includes('png'));
});

test('client-safe extensions list stays in sync with the adapter-derived list', () => {
  assert.deepEqual([...clientAcceptedExtensions].sort(), [...acceptedIngestionExtensions].sort());
});

test('ingestFile handles uppercase extensions (NOTES.TXT)', async () => {
  const result = await ingestFile(makeFile('NOTES.TXT', 'hello', 'text/plain'));

  assert.equal(result.text, 'hello');
  assert.equal(result.meta.fileName, 'NOTES.TXT');
});

test('ingestFile rejects a file with no extension and no matching MIME type', async () => {
  await assert.rejects(
    ingestFile(makeFile('README', 'some content', '')),
    (error) => error instanceof IngestionError && /not a supported file type/.test(error.message),
  );
});

test('ingestFile matches via MIME type when extension is not recognized', async () => {
  // Simulates a file whose name has an unrecognized extension but whose MIME type
  // is a known text type (browser-reported MIME used as fallback).
  const result = await ingestFile(makeFile('notes.unknown', 'content', 'text/plain'));

  assert.equal(result.text, 'content');
});

test('normalizeOCTText strips OCR noise and normalizes list formatting', () => {
  const result = normalizeOCTText(`Photosynthesis\r\n\r\n\n   chlorophyll absorbs light   \nPage 1\n• water splits\n* oxygen released\n\n`);

  assert.equal(result, 'Photosynthesis\n\nchlorophyll absorbs light\n- water splits\n- oxygen released');
});

test('convertNormalizedTextSourceNotesFormat structures OCR text into Source Notes format', () => {
  const result = convertNormalizedTextSourceNotesFormat([
    'Cell Biology',
    'Photosynthesis',
    'Light-dependent reactions',
    'Electron transport',
    'chlorophyll absorbs light',
    'water is split into oxygen and protons',
    'ATP and NADPH are produced',
  ].join('\n'));

  assert.equal(result, [
    'Main Topic: Cell Biology',
    '',
    'Sub Topic: Photosynthesis',
    'Sub sub Topic: Light-dependent reactions',
    'Sub sub sub Topic: Electron transport',
    'Examples:',
    '',
    '- chlorophyll absorbs light',
    '- water is split into oxygen and protons',
    '- ATP and NADPH are produced',
  ].join('\n'));
});

test('convertNormalizedTextSourceNotesFormat cleans noisy OCR chapter pages into structured Source Notes', () => {
  const noisyOcr = [
    ': 21',
    'i ntroduction 10 Sociology',
    ': O SOCIOLOG £2',
    'oy 301 : INTRODUCTION x me :',
    'E30 1. Introductory Words iol ones',
    '2 rea an society, Te Sines',
    'soiology is the scientific study of hum 1 pe ga Ve:',
    'Sociolog f behavior. It explores A a',
    'Concept of Sociology',
    'Sociology is the scientific study of human society,',
    'social relationships, and group behaviour.',
    'Auguste Comte',
    'According to Comte, sociology is the scientific study of society.',
    'Emile Durkheim',
    'Durkheim defined sociology as the study of social facts.',
  ].join('\n');

  const result = convertNormalizedTextSourceNotesFormat(noisyOcr);

  assert.match(result, /^Main Topic: Introduction to Sociology/);
  assert.match(result, /Sub Topic: Concept of Sociology/);
  assert.match(result, /Sub sub Topic: Auguste Comte/);
  assert.match(result, /Sub sub sub Topic: Emile Durkheim/);
  assert.match(result, /Examples:/);
});

test('ingestFiles with empty array returns empty result without errors', async () => {
  const result = await ingestFiles([]);

  assert.equal(result.text, '');
  assert.deepEqual(result.ingested, []);
  assert.deepEqual(result.errors, []);
});
