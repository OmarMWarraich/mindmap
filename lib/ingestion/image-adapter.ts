import { IngestionError, type IngestedFile, type IngestionAdapter } from './types.ts';

export type ImageTextExtractor = (file: File) => Promise<string>;

export interface ImageIngestionAdapterOptions {
  /** OCR path for note photos / screenshots. Chosen path: Tesseract.js now; a vision model stays a future upgrade. */
  textExtractor?: ImageTextExtractor;
}

export const maxImageBytes = 12 * 1024 * 1024;

const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff', 'heic', 'heif'];
const imageMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/tiff',
  'image/heic',
  'image/heif',
];

function normalizeExtractedText(text: string): string {
  return text.replace(/\r\n?/gu, '\n').replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
}

async function defaultImageTextExtractor(file: File): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    const result = await worker.recognize(file);
    return normalizeExtractedText(result.data.text);
  } catch (error) {
    if (error instanceof IngestionError) {
      throw error;
    }
    throw new IngestionError(
      `"${file.name}" did not produce any readable text. Try a sharper image, a clearer scan, or paste the notes manually.`,
      { cause: error },
    );
  } finally {
    await worker.terminate();
  }
}

export function createImageIngestionAdapter(
  options: ImageIngestionAdapterOptions = {},
): IngestionAdapter {
  const textExtractor = options.textExtractor ?? defaultImageTextExtractor;

  return {
    id: 'image',
    extensions: imageExtensions,
    mimeTypes: imageMimeTypes,
    maxBytes: maxImageBytes,
    async read(file: File): Promise<IngestedFile> {
      let text: string;
      try {
        text = normalizeExtractedText(await textExtractor(file));
      } catch (error) {
        if (error instanceof IngestionError) {
          throw error;
        }
        throw new IngestionError(
          `"${file.name}" could not be OCRed. Try a sharper image, a clearer scan, or paste the notes manually.`,
          { cause: error },
        );
      }

      if (!text) {
        throw new IngestionError(
          `"${file.name}" did not produce any readable text. Try a sharper image, a clearer scan, or paste the notes manually.`,
        );
      }

      return {
        text,
        meta: {
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
        },
      };
    },
  };
}
