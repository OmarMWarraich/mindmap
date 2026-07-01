import assert from 'node:assert/strict';
import test from 'node:test';

import { maxSourceTextCharacters } from '../generation/limits.ts';
import { acceptedIngestionExtensions, ingestFile, ingestFiles } from './ingest.ts';
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

test('ingestFile rejects an unsupported file type', async () => {
  await assert.rejects(
    ingestFile(makeFile('slides.pdf', '%PDF-1.7 binary', 'application/pdf')),
    (error) => error instanceof IngestionError && /not a supported file type/.test(error.message),
  );
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
    makeFile('bad.pdf', 'nope', 'application/pdf'),
    makeFile('b.md', 'second', ''),
  ]);

  assert.equal(result.text, 'first\n\nsecond');
  assert.equal(result.ingested.length, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.fileName, 'bad.pdf');
});

test('acceptedIngestionExtensions advertises txt and md', () => {
  assert.ok(acceptedIngestionExtensions.includes('txt'));
  assert.ok(acceptedIngestionExtensions.includes('md'));
});
