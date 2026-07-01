import type * as Pdfjs from 'pdfjs-dist';

import { IngestionError, type IngestedFile, type IngestionAdapter } from './types.ts';

// Extracts the text of each page of a PDF. Injected so the adapter's logic
// (page-join, scanned detection, page cap) is unit-testable without pdf.js —
// mirroring how the mindmap layout client injects its worker factory.
export type PdfPageExtractor = (data: ArrayBuffer) => Promise<string[]>;

export const maxPdfPages = 80;

// 25 MiB — PDFs carry binary overhead (fonts, figures) well beyond their text, so
// they warrant a higher pre-read ceiling than the shared default.
export const maxPdfBytes = 25 * 1024 * 1024;

// A digital PDF yields substantial text per page; a scanned/image-only PDF yields
// almost none (no text layer). Flag as scanned when the average extractable text
// per page falls below this — catches both an empty single page and multi-page
// scans whose only "text" is repeated headers or page numbers.
const minCharsPerPage = 24;

// Two deliberate choices here, both for browser compatibility:
//
// 1. The LEGACY build (transpiled + core-js polyfills). The standard build uses
//    Promise.withResolvers and other very recent APIs (Safari 17.4+); the legacy
//    build polyfills them, so extraction works in older Safari too. Same API
//    surface, hence the cast to the typed namespace.
// 2. MAIN-THREAD execution. Importing the worker *module* registers
//    globalThis.pdfjsWorker, so pdf.js uses its in-process handler (#initialize
//    short-circuits to the fake worker) instead of spawning a Web Worker — which
//    fails to instantiate under Turbopack in some browsers, and whose pdf.js
//    fallback dynamically imports a runtime URL Turbopack cannot resolve.
//
// Everything is dynamically imported so the (browser-only) library never loads
// during SSR or the Node test runner. Extraction is a bounded, one-shot op, so
// the brief main-thread cost is acceptable.
async function defaultExtractPdfPages(data: ArrayBuffer): Promise<string[]> {
  const [pdfjsModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
  ]);
  const pdfjs = pdfjsModule as typeof Pdfjs;

  const loadingTask = pdfjs.getDocument({ data });

  try {
    const doc = await loadingTask.promise;
    // Read at most one page past the cap: enough for the adapter to detect an
    // over-limit document without extracting hundreds of pages first.
    const pageLimit = Math.min(doc.numPages, maxPdfPages + 1);
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      // Respect end-of-line markers so headings/lists keep their line structure
      // (it feeds hierarchy detection); other runs are space-separated.
      let pageText = '';
      for (const item of content.items) {
        if (!('str' in item)) {
          continue;
        }
        pageText += item.hasEOL ? `${item.str}\n` : `${item.str} `;
      }
      pages.push(pageText);
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Ingestion adapter for digital (text-based) PDFs. Extracts text client-side and
 * hands it to the existing generation pipeline. Scanned/image-only PDFs are out
 * of scope here — they are detected and rejected with a message pointing at the
 * future image/OCR path.
 */
export function createPdfIngestionAdapter(
  extractPages: PdfPageExtractor = defaultExtractPdfPages,
): IngestionAdapter {
  return {
    id: 'pdf',
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    maxBytes: maxPdfBytes,
    async read(file: File): Promise<IngestedFile> {
      const data = await file.arrayBuffer();

      // Normalize provider-specific failures (corrupt / encrypted / password
      // protected) into a clean IngestionError; keep the original as `cause`.
      let pages: string[];
      try {
        pages = await extractPages(data);
      } catch (error) {
        if (error instanceof IngestionError) {
          throw error;
        }
        throw new IngestionError(
          `"${file.name}" could not be read as a PDF. It may be corrupted, encrypted, or password-protected.`,
          { cause: error },
        );
      }

      if (pages.length > maxPdfPages) {
        throw new IngestionError(
          `"${file.name}" has too many pages (over ${maxPdfPages}). `
            + 'Split it into smaller PDFs and attach them separately.',
        );
      }

      const text = pages.join('\n\n').trim();

      // Average extractable text per page — see minCharsPerPage.
      if (text.replace(/\s/gu, '').length < minCharsPerPage * Math.max(1, pages.length)) {
        throw new IngestionError(
          `"${file.name}" has no extractable text — it looks scanned or image-only. `
            + 'Image/OCR support is coming; for now use a text-based PDF or paste the text.',
        );
      }

      return {
        text,
        meta: {
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          pageCount: pages.length,
        },
      };
    },
  };
}
