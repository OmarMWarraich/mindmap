import assert from 'node:assert/strict';
import test from 'node:test';

import { createPdfIngestionAdapter, maxPdfPages, type PdfPageExtractor } from './pdf-adapter.ts';
import { IngestionError } from './types.ts';

function pdfFile(name = 'doc.pdf'): File {
  // Content is irrelevant — the extractor is injected, so pdf.js never runs.
  return new File(['%PDF-1.7'], name, { type: 'application/pdf' });
}

function extractorReturning(pages: string[]): PdfPageExtractor {
  return async () => pages;
}

test('PDF adapter joins page text with blank lines and reports page count', async () => {
  const adapter = createPdfIngestionAdapter(extractorReturning(['Page one text', 'Page two text']));

  const result = await adapter.read(pdfFile('chapter.pdf'));

  assert.equal(result.text, 'Page one text\n\nPage two text');
  assert.equal(result.meta.fileName, 'chapter.pdf');
  assert.equal(result.meta.mimeType, 'application/pdf');
  assert.equal(result.meta.pageCount, 2);
});

test('PDF adapter detects a scanned/image-only PDF (no extractable text)', async () => {
  const adapter = createPdfIngestionAdapter(extractorReturning(['', '   ', '\n']));

  await assert.rejects(
    adapter.read(pdfFile('scanned.pdf')),
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

test('PDF adapter advertises the pdf extension and mime type', () => {
  const adapter = createPdfIngestionAdapter(extractorReturning(['x']));

  assert.deepEqual(adapter.extensions, ['pdf']);
  assert.deepEqual(adapter.mimeTypes, ['application/pdf']);
});
