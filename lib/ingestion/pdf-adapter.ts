import { IngestionError, type IngestedFile, type IngestionAdapter } from './types.ts';

// Extracts the text of each page of a PDF. Injected so the adapter's logic
// (page-join, scanned detection, page cap) is unit-testable without pdf.js —
// mirroring how the mindmap layout client injects its worker factory.
export type PdfPageExtractor = (data: ArrayBuffer) => Promise<string[]>;

export const maxPdfPages = 80;

// If the whole document yields fewer than this many non-whitespace characters, it
// is almost certainly scanned/image-only rather than digital text.
const scannedTextThreshold = 16;

let workerConfigured = false;

// Default extractor backed by pdf.js. Dynamically imported so the (browser-only)
// library never loads during SSR or the Node test runner — only when a PDF is
// actually read in the browser.
async function defaultExtractPdfPages(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');

  if (!workerConfigured) {
    // Statically-analyzable URL so Turbopack/webpack bundle the worker asset,
    // the same pattern the mindmap layout worker uses.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

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
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
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
    async read(file: File): Promise<IngestedFile> {
      const data = await file.arrayBuffer();
      const pages = await extractPages(data);

      if (pages.length > maxPdfPages) {
        throw new IngestionError(
          `"${file.name}" has too many pages (over ${maxPdfPages}). `
            + 'Split it into smaller PDFs and attach them separately.',
        );
      }

      const text = pages.join('\n\n').trim();

      if (text.replace(/\s/gu, '').length < scannedTextThreshold) {
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
