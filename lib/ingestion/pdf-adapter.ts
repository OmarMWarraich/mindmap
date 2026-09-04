import type * as Pdfjs from 'pdfjs-dist';
import type { PDFPageProxy }from 'pdfjs-dist';

import { requestVisionExtraction, toVisionDataUrl } from './image-adapter.ts';
import { convertNormalizedTextSourceNotesFormat } from './ocr-normalizer.ts';
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

type PdfViewport = ReturnType<PDFPageProxy['getViewport']>;
type PdfRenderOptions = Parameters<PDFPageProxy['render']>[0];

function ensureDomMatrixPolyfill(): void {
  if (typeof globalThis === 'undefined' || typeof (globalThis as typeof globalThis & { DOMMatrix?: unknown }).DOMMatrix !== 'undefined') {
    return;
  }

  class DOMMatrixPolyfill {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    is2D: boolean;
    isIdentity: boolean;

    constructor(init?: string | number[] | { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }) {
      const matrix = parseDomMatrixInit(init);
      this.a = matrix.a;
      this.b = matrix.b;
      this.c = matrix.c;
      this.d = matrix.d;
      this.e = matrix.e;
      this.f = matrix.f;
      this.is2D = true;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
    }

    scaleSelf(scaleX = 1, scaleY = 1, scaleZ = 1, originX = 0, originY = 0, originZ = 0): DOMMatrixPolyfill {
      this.a *= scaleX;
      this.b *= scaleX;
      this.c *= scaleY;
      this.d *= scaleY;
      this.e += originX * (scaleX - 1) + originY * this.c;
      this.f += originY * (scaleY - 1) + originX * this.b;
      void scaleZ;
      void originZ;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      return this;
    }

    translateSelf(tx = 0, ty = 0, tz = 0): DOMMatrixPolyfill {
      this.e += tx;
      this.f += ty;
      void tz;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      return this;
    }

    multiplySelf(other?: { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }): DOMMatrixPolyfill {
      const matrix = parseDomMatrixInit(other);
      const nextA = this.a * matrix.a + this.c * matrix.b;
      const nextB = this.b * matrix.a + this.d * matrix.b;
      const nextC = this.a * matrix.c + this.c * matrix.d;
      const nextD = this.b * matrix.c + this.d * matrix.d;
      const nextE = this.a * matrix.e + this.c * matrix.f + this.e;
      const nextF = this.b * matrix.e + this.d * matrix.f + this.f;
      this.a = nextA;
      this.b = nextB;
      this.c = nextC;
      this.d = nextD;
      this.e = nextE;
      this.f = nextF;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      return this;
    }

    preMultiplySelf(other?: { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }): DOMMatrixPolyfill {
      return this.multiplySelf(other);
    }

    setMatrixValue(transformList: string): DOMMatrixPolyfill {
      const parsed = parseDomMatrixInit(transformList);
      this.a = parsed.a;
      this.b = parsed.b;
      this.c = parsed.c;
      this.d = parsed.d;
      this.e = parsed.e;
      this.f = parsed.f;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      return this;
    }

    invertSelf(): DOMMatrixPolyfill {
      const determinant = this.a * this.d - this.b * this.c;
      if (!determinant) {
        return this;
      }
      const nextA = this.d / determinant;
      const nextB = -this.b / determinant;
      const nextC = -this.c / determinant;
      const nextD = this.a / determinant;
      const nextE = -(this.a * this.e + this.c * this.f) / determinant;
      const nextF = -(this.b * this.e + this.d * this.f) / determinant;
      this.a = nextA;
      this.b = nextB;
      this.c = nextC;
      this.d = nextD;
      this.e = nextE;
      this.f = nextF;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      return this;
    }

    static fromFloat32Array(array32: Float32Array): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill(Array.from(array32.slice(0, 6)));
    }

    static fromFloat64Array(array64: Float64Array): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill(Array.from(array64.slice(0, 6)));
    }

    static fromMatrix(other?: { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill(other);
    }
  }

  const globalWithDomMatrix = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    SVGMatrix?: typeof SVGMatrix;
  };
  globalWithDomMatrix.DOMMatrix = DOMMatrixPolyfill as unknown as typeof DOMMatrix;
  globalWithDomMatrix.SVGMatrix = DOMMatrixPolyfill as unknown as typeof SVGMatrix;
}

function parseDomMatrixInit(
  init?: string | number[] | { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number },
): { a: number; b: number; c: number; d: number; e: number; f: number } {
  if (typeof init === 'string') {
    const match = init.match(/matrix\(([^)]+)\)/i) ?? init.match(/\(([^)]+)\)/);
    if (match) {
      const values = match[1]!.split(/\s+/).filter(Boolean).map(Number);
      if (values.length >= 6) {
        return { a: values[0] ?? 1, b: values[1] ?? 0, c: values[2] ?? 0, d: values[3] ?? 1, e: values[4] ?? 0, f: values[5] ?? 0 };
      }
    }
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  if (Array.isArray(init)) {
    return {
      a: init[0] ?? 1,
      b: init[1] ?? 0,
      c: init[2] ?? 0,
      d: init[3] ?? 1,
      e: init[4] ?? 0,
      f: init[5] ?? 0,
    };
  }

  return {
    a: init?.a ?? 1,
    b: init?.b ?? 0,
    c: init?.c ?? 0,
    d: init?.d ?? 1,
    e: init?.e ?? 0,
    f: init?.f ?? 0,
  };
}

export const maxPdfPages = 80;

// 25 MiB — PDFs carry binary overhead (fonts, figures) well beyond their text, so
// they warrant a higher pre-read ceiling than the shared default.
export const maxPdfBytes = 25 * 1024 * 1024;

function normalizeExtractedText(text: string): string {
  return text.replace(/\r\n?/gu, '\n').replace(/[ \t]+\n/gu, '\n').trim();
}

function looksLikeRawOcrNoise(text: string): boolean {
  const normalized = text.replace(/\r\n?/gu, '\n').trim();
  if (!normalized) {
    return false;
  }

  if (/^(?:main topic|sub topic|sub sub topic|sub sub sub topic|examples)\s*:/i.test(normalized)) {
    return false;
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.some((line) => {
    const pageNoise = /^page\s+\d+/i.test(line) || /^\d+$/.test(line);
    const artifactNoise = /[£§]/.test(line);
    const weirdSpacing = /\b[a-z]\s+[a-z]\b/i.test(line) || /\b[a-z]{1,3}\s+[a-z]{1,3}\b/i.test(line);
    return pageNoise || artifactNoise || weirdSpacing;
  });
}

export async function isLikelyPdfFile(file: File): Promise<boolean> {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return false;
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return header.length >= 5 && header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2d;
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

async function renderPdfPageToBuffer(
  page: PDFPageProxy,
  viewport: PdfViewport,
): Promise<Buffer> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  const renderTask = page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  } as PdfRenderOptions);

  await renderTask.promise;
  return canvas.toBuffer('image/png');
}

async function defaultVisionPdfPageText(
  pageNumber: number,
  fileName: string,
  data: ArrayBuffer,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new IngestionError(
      `"${fileName}" requires OPENAI_API_KEY before scanned PDFs can be extracted. Configure it and try again.`,
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
    const pngBuffer = await renderPdfPageToBuffer(page, viewport);
    const dataUrl = await toVisionDataUrl(pngBuffer, 'image/png');
    return normalizeExtractedText(await requestVisionExtraction(apiKey, dataUrl));
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
  const ocrPageText = options.ocrPageText ?? ((pageNumber, fileName, data) => defaultVisionPdfPageText(pageNumber, fileName, data));

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
      // truly scanned or image-only, fall back to vision page-by-page and continue
      // through the same Source Notes generation flow, but keep the page budget bounded.
      if (text.replace(/\s/gu, '').length < minCharsPerPage * Math.max(1, pages.length)) {
        const pageBudget = Math.min(pages.length, 4);
        const ocrPages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pageBudget; pageNumber += 1) {
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

        const structuredOcrText = looksLikeRawOcrNoise(ocrText)
          ? (convertNormalizedTextSourceNotesFormat(ocrText) || ocrText)
          : ocrText;

        return {
          text: structuredOcrText,
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
