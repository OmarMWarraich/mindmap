import assert from 'node:assert/strict';
import test from 'node:test';

import { maxSourceTextCharacters } from '../generation/limits.ts';
import { createImageIngestionAdapter } from './image-adapter.ts';
import { acceptedIngestionExtensions, ingestFile, ingestFiles } from './ingest.ts';
import { convertNormalizedTextSourceNotesFormat, normalizeOCTText } from './ocr-normalizer.ts';
import { IngestionError } from './types.ts';

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
  const result = await adapter.read(makeFile('photo.png', 'binary', 'image/png'));

  assert.equal(result.text, 'Lecture notes\n\nPhotosynthesis and respiration');
  assert.equal(result.meta.fileName, 'photo.png');
  assert.equal(result.meta.mimeType, 'image/png');
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

test('ingestFiles with empty array returns empty result without errors', async () => {
  const result = await ingestFiles([]);

  assert.equal(result.text, '');
  assert.deepEqual(result.ingested, []);
  assert.deepEqual(result.errors, []);
});
