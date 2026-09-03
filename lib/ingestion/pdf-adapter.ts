import type * as Pdfjs from 'pdfjs-dist';

import { IngestionError, type IngestedFile, type IngestionAdapter } from './types.ts';

// Extracts the text of each page of a PDF. Injected so the adapter's logic
// (page-join, scanned detection, page cap) is unit-testable without pdf.js —
// mirroring how the mindmap layout client injects its worker factory.
export type PdfPageExtractor = (data: ArrayBuffer) => Promise<string[]>;
export type PdfOcrPageExtractor = (pageNumber: number, fileName: string, data: ArrayBuffer) => Promise<string>;

export interface PdfIngestionAdapterOptions {
  /** OCR fallback for image-only or scanned PDFs. Chosen path: Tesseract.js now; a vision model stays a future upgrade. */
  ocrPageText?: PdfOcrPageExtractor;
}

export const maxPdfPages = 80;

// 25 MiB — PDFs carry binary overhead (fonts, figures) well beyond their text, so
// they warrant a higher pre-read ceiling than the shared default.
export const maxPdfBytes = 25 * 1024 * 1024;

function normalizeExtractedText(text: string): string {
  return text.replace(/\r\n?/gu, '\n').replace(/[ \t]+\n/gu, '\n').trim();
}

export function shouldPolyfillPdfjsReadableStreams(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  if (!userAgent) {
    return false;
  }

  return /Safari\//.test(userAgent)
    && !/(Chrome|CriOS|Chromium|Edg|EdgiOS|OPR|FxiOS|SamsungBrowser)/.test(userAgent);
}

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
  // Safari has a known `ReadableStream`/`getTextContent()` bug in pdf.js; the
  // polyfill must be loaded before pdf.js initializes so it uses the compatible
  // stream implementation instead of Safari's broken native one.
  if (
    typeof navigator !== 'undefined'
    && shouldPolyfillPdfjsReadableStreams(navigator.userAgent)
  ) {
    await import('web-streams-polyfill/polyfill');
  }

  const [pdfjsModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
  ]);
  const pdfjs = pdfjsModule as typeof Pdfjs;

  const loadingTask = pdfjs.getDocument({
    data,
    // Defense-in-depth for parsing untrusted PDFs client-side: we only extract
    // text (getTextContent), so no @font-face rendering is needed — disabling it
    // trims the font attack surface. (pdf.js v6 removed the older
    // `isEvalSupported` option; the eval font-exec path no longer exists, so
    // keeping pdfjs patched via SCA is the primary mitigation.) See
    // docs/ISSUE_NO_16.md.
    disableFontFace: true,
  });

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

async function defaultOcrPdfPageText(
  pageNumber: number,
  fileName: string,
  data: ArrayBuffer,
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new IngestionError(
      `"${fileName}" has no extractable text — it looks scanned or image-only. Please upload a clearer scan or paste the notes manually.`,
    );
  }

  const [pdfjsModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
  ]);
  const pdfjs = pdfjsModule as typeof Pdfjs;
  const loadingTask = pdfjs.getDocument({ data, disableFontFace: true });

  try {
    const doc = await loadingTask.promise;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new IngestionError(
        `"${fileName}" has no extractable text — it looks scanned or image-only. Please upload a clearer scan or paste the notes manually.`,
      );
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(canvas);
      return normalizeExtractedText(result.data.text);
    } finally {
      await worker.terminate();
    }
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Ingestion adapter for PDF files. Digital PDFs are extracted directly with
 * pdf.js. Scanned or image-only PDFs fall back to OCR (Tesseract.js now), while
 * a vision model remains a later upgrade if quality issues justify the extra
 * token cost.
 */
export function createPdfIngestionAdapter(
  extractPages: PdfPageExtractor = defaultExtractPdfPages,
  options: PdfIngestionAdapterOptions = {},
): IngestionAdapter {
  const ocrPageText = options.ocrPageText ?? ((pageNumber, fileName, data) => defaultOcrPdfPageText(pageNumber, fileName, data));

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

      const text = normalizeExtractedText(pages.join('\n\n'));

      // Average extractable text per page — see minCharsPerPage. If the PDF is
      // truly scanned or image-only, fall back to OCR page-by-page and continue
      // through the same Source Notes generation flow.
      if (text.replace(/\s/gu, '').length < minCharsPerPage * Math.max(1, pages.length)) {
        const ocrPages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pages.length; pageNumber += 1) {
          try {
            const pageText = normalizeExtractedText(await ocrPageText(pageNumber, file.name, data));
            if (pageText && pageText !== ocrPages.at(-1)) {
              ocrPages.push(pageText);
            }
          } catch (error) {
            if (error instanceof IngestionError) {
              throw error;
            }
            throw new IngestionError(
              `"${file.name}" could not be OCRed. Please upload a clearer scan or paste the notes manually.`,
              { cause: error },
            );
          }
        }

        const ocrText = normalizeExtractedText(ocrPages.join('\n\n'));
        if (
          !ocrText
          || ocrText.replace(/\s/gu, '').length < minCharsPerPage * Math.max(1, ocrPages.length)
        ) {
          throw new IngestionError(
            `"${file.name}" has no extractable text — it looks scanned or image-only. Please upload a clearer scan or paste the notes manually.`,
          );
        }

        return {
          text: ocrText,
          meta: {
            fileName: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            pageCount: pages.length,
          },
        };
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
