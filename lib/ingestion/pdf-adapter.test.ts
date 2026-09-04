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

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildMinimalPdf(value: string): Uint8Array<ArrayBuffer> {
  const stream = `BT\n/F1 18 Tf\n50 80 Td\n(${escapePdfText(value)}) Tj\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 0; index < objects.length; index += 1) {
    pdf += `${String(offsets[index + 1]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const encoded = new TextEncoder().encode(pdf);
  const bytes = new Uint8Array(encoded.length);
  bytes.set(encoded);
  return bytes as Uint8Array<ArrayBuffer>;
}

function pdfFile(name = 'doc.pdf', text = 'Photosynthesis'): File {
  return new File([buildMinimalPdf(text)], name, { type: 'application/pdf' });
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

test('PDF adapter OCRs a scanned/image-only PDF when no text layer exists', async () => {
  const adapter = createPdfIngestionAdapter(extractorReturning(['', '   ', '\n']), {
    ocrPageText: async () => 'Lecture notes\n\nKey ideas and takeaways',
  });

  const result = await adapter.read(pdfFile('scanned.pdf'));

  assert.equal(result.text, 'Lecture notes\n\nKey ideas and takeaways');
  assert.equal(result.meta.pageCount, 3);
});

test('PDF adapter falls back to the server-safe vision path when the PDF is scanned and no DOM exists', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test';

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: [{ type: 'text', text: 'Main Topic: Biology\n\nSub Topic: Photosynthesis' }] } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const adapter = createPdfIngestionAdapter(extractorReturning(['', '   ']), {
    ocrPageText: async () => 'Main Topic: Biology\n\nSub Topic: Photosynthesis',
  });
    const result = await adapter.read(pdfFile('scanned-server.pdf', 'Biology'));

    assert.match(result.text, /^Main Topic: Biology/);
    assert.match(result.text, /Sub Topic: Photosynthesis/);
    assert.equal(result.meta.pageCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('PDF adapter flags a multi-page PDF whose only text is sparse headers as scanned', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test';

  try {
    // Ten pages, each with just a running header / page number — well below the
    // per-page average, so the whole document is treated as scanned.
    const sparsePages = Array.from({ length: 10 }, (_, index) => `p.${index + 1}`);
    const adapter = createPdfIngestionAdapter(extractorReturning(sparsePages), {
      ocrPageText: async () => 'Main Topic: Header only',
    });

    await assert.rejects(
      adapter.read(pdfFile('sparse-scan.pdf')),
      (error) => error instanceof IngestionError && /scanned or image-only/.test(error.message),
    );
  } finally {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
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
