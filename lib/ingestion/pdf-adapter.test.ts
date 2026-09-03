import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPdfIngestionAdapter,
  maxPdfBytes,
  maxPdfPages,
  shouldPolyfillPdfjsReadableStreams,
  type PdfPageExtractor,
} from './pdf-adapter.ts';
import { IngestionError } from './types.ts';

function pdfFile(name = 'doc.pdf'): File {
  // Content is irrelevant — the extractor is injected, so pdf.js never runs.
  return new File(['%PDF-1.7'], name, { type: 'application/pdf' });
}

function extractorReturning(pages: string[]): PdfPageExtractor {
  return async () => pages;
}

test('PDF adapter joins page text with blank lines and reports page count', async () => {
  const adapter = createPdfIngestionAdapter(
    extractorReturning([
      'Page one covers the introduction and background of the subject in detail.',
      'Page two continues with the core mechanisms and worked examples for clarity.',
    ]),
  );

  const result = await adapter.read(pdfFile('chapter.pdf'));

  assert.equal(
    result.text,
    'Page one covers the introduction and background of the subject in detail.\n\n'
      + 'Page two continues with the core mechanisms and worked examples for clarity.',
  );
  assert.equal(result.meta.fileName, 'chapter.pdf');
  assert.equal(result.meta.mimeType, 'application/pdf');
  assert.equal(result.meta.pageCount, 2);
});

test('PDF adapter accepts a short single-page PDF with real text', async () => {
  const adapter = createPdfIngestionAdapter(extractorReturning(['Introduction to Photosynthesis']));

  const result = await adapter.read(pdfFile('title.pdf'));

  assert.equal(result.text, 'Introduction to Photosynthesis');
  assert.equal(result.meta.pageCount, 1);
});

test('PDF adapter detects a scanned/image-only PDF (no extractable text)', async () => {
  const adapter = createPdfIngestionAdapter(extractorReturning(['', '   ', '\n']));

  await assert.rejects(
    adapter.read(pdfFile('scanned.pdf')),
    (error) => error instanceof IngestionError && /scanned or image-only/.test(error.message),
  );
});

test('PDF adapter flags a multi-page PDF whose only text is sparse headers as scanned', async () => {
  // Ten pages, each with just a running header / page number — well below the
  // per-page average, so the whole document is treated as scanned.
  const sparsePages = Array.from({ length: 10 }, (_, index) => `p.${index + 1}`);
  const adapter = createPdfIngestionAdapter(extractorReturning(sparsePages));

  await assert.rejects(
    adapter.read(pdfFile('sparse-scan.pdf')),
    (error) => error instanceof IngestionError && /scanned or image-only/.test(error.message),
  );
});

test('PDF adapter rejects a document over the page cap', async () => {
  const tooManyPages = Array.from({ length: maxPdfPages + 1 }, (_, index) => `Page ${index + 1}`);
  const adapter = createPdfIngestionAdapter(extractorReturning(tooManyPages));

  await assert.rejects(
    adapter.read(pdfFile('huge.pdf')),
    (error) => error instanceof IngestionError && /too many pages/.test(error.message),
  );
});

test('PDF adapter normalizes an extractor failure into a clean IngestionError', async () => {
  const failingExtractor: PdfPageExtractor = async () => {
    throw new Error('PasswordException: No password given');
  };
  const adapter = createPdfIngestionAdapter(failingExtractor);

  await assert.rejects(
    adapter.read(pdfFile('encrypted.pdf')),
    (error) =>
      error instanceof IngestionError
      && /corrupted, encrypted, or password-protected/.test(error.message)
      // Original error preserved for debugging.
      && error.cause instanceof Error
      && /PasswordException/.test((error.cause as Error).message),
  );
});

test('PDF adapter opts into a ReadableStream polyfill in Safari', () => {
  assert.equal(
    shouldPolyfillPdfjsReadableStreams('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15'),
    true,
  );
  assert.equal(
    shouldPolyfillPdfjsReadableStreams('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'),
    false,
  );
});

test('PDF adapter advertises the pdf type and a higher byte ceiling', () => {
  const adapter = createPdfIngestionAdapter(extractorReturning(['x']));

  assert.deepEqual(adapter.extensions, ['pdf']);
  assert.deepEqual(adapter.mimeTypes, ['application/pdf']);
  assert.equal(adapter.maxBytes, maxPdfBytes);
});
