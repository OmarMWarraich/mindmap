import { convertNormalizedTextSourceNotesFormat } from './ocr-normalizer.ts';
import { IngestionError, type IngestedFile, type IngestionAdapter } from './types.ts';

export type ImageTextExtractor = (file: File) => Promise<string>;

export interface ImageIngestionAdapterOptions {
  /** Preferred path: LLM vision extraction when a model is available. OCR is the fallback for files that do not carry model-backed extraction. */
  textExtractor?: ImageTextExtractor;
}

export const maxImageBytes = 12 * 1024 * 1024;
export const maxVisionProviderTimeoutMs = 30_000;
export const maxVisionAttemptsPerImage = 3;

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

  if (lines.length === 0) {
    return false;
  }

  const noisyLineCount = lines.filter((line) => {
    const short = line.length < 60;
    const numericNoise = /\d/.test(line) && short;
    const weirdSpacing = /\b[a-z]\s+[a-z]\b/i.test(line) || /\b[a-z]{1,3}\s+[a-z]{1,3}\b/i.test(line);
    const pageNoise = /^page\s+\d+/i.test(line) || /^\d+$/.test(line);
    const artifactNoise = /[£§]/.test(line);
    return numericNoise || weirdSpacing || pageNoise || artifactNoise;
  }).length;

  return noisyLineCount >= 1;
}

export function formatSourceNotesText(text: string): string {
  if (!text.trim() || !looksLikeRawOcrNoise(text)) {
    return text;
  }

  const formatted = convertNormalizedTextSourceNotesFormat(text);
  return formatted || text;
}

export function isLikelyImageFile(file: File): boolean {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith('image/')) {
    return true;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension) {
    return false;
  }

  return imageExtensions.includes(extension);
}

export async function validateImageFile(file: File): Promise<void> {
  if (!isLikelyImageFile(file)) {
    throw new IngestionError(`"${file.name}" is not a valid image file.`);
  }

  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (signature.length === 0) {
    throw new IngestionError(`"${file.name}" is not a valid image file.`);
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const jpegSignature = [0xff, 0xd8, 0xff];
  const gifSignature = [0x47, 0x49, 0x46];
  const bmpSignature = [0x42, 0x4d];
  const webpSignature = [0x52, 0x49, 0x46, 0x46];
  const tiffSignature = [0x49, 0x49, 0x2a, 0x00];
  const tiffBigEndianSignature = [0x4d, 0x4d, 0x00, 0x2a];
  const heicSignature = [0x66, 0x74, 0x79, 0x70];

  const matches = (bytes: number[]) => bytes.every((byte, index) => signature[index] === byte);

  if (
    matches(pngSignature)
    || matches(jpegSignature)
    || matches(gifSignature)
    || matches(bmpSignature)
    || (matches(webpSignature) && signature[8] === 0x57 && signature[9] === 0x45 && signature[10] === 0x42 && signature[11] === 0x50)
    || matches(tiffSignature)
    || matches(tiffBigEndianSignature)
    || (matches(heicSignature) && signature[4] === 0x68 && signature[5] === 0x65 && signature[6] === 0x69 && signature[7] === 0x63)
  ) {
    return;
  }

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif') || fileName.endsWith('.bmp') || fileName.endsWith('.webp') || fileName.endsWith('.tif') || fileName.endsWith('.tiff') || fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    throw new IngestionError(`"${file.name}" is not a valid image file.`);
  }
}

function extractVisionTextPayload(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const visitNode = (node: unknown): string => {
    if (typeof node === 'string') {
      return node;
    }

    if (!node || typeof node !== 'object') {
      return '';
    }

    const record = node as Record<string, unknown>;
    if (typeof record.text === 'string') {
      return record.text;
    }

    if (typeof record.content === 'string') {
      return record.content;
    }

    if (Array.isArray(record.content)) {
      return record.content.map((part) => visitNode(part)).join('');
    }

    if (Array.isArray(record.output)) {
      return record.output.map((part) => visitNode(part)).join('');
    }

    if (Array.isArray(record.items)) {
      return record.items.map((part) => visitNode(part)).join('');
    }

    if (Array.isArray(record.text)) {
      return record.text.map((part) => visitNode(part)).join('');
    }

    if (Array.isArray(record.messages)) {
      return record.messages.map((part) => visitNode(part)).join('');
    }

    if (Array.isArray(record.choices)) {
      return record.choices.map((part) => visitNode(part)).join('');
    }

    if (record.message && typeof record.message === 'object') {
      return visitNode(record.message);
    }

    if (record.output_text && typeof record.output_text === 'object') {
      return visitNode(record.output_text);
    }

    return '';
  };

  const record = payload as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }

  if (typeof record.content === 'string') {
    return record.content;
  }

  if (Array.isArray(record.content) || Array.isArray(record.output) || Array.isArray(record.choices)) {
    return visitNode(payload);
  }

  return visitNode(payload);
}

const visionRefusalPattern = /(?:unable to (?:read|extract|transcribe)|can't read|cannot read|couldn't read|no (?:readable|legible) text|can't assist|cannot assist)/iu;

function isUnreadableVisionOutput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  return trimmed.length < 240 && visionRefusalPattern.test(trimmed);
}

export async function toVisionDataUrl(bytes: Buffer, mimeType: string): Promise<string> {
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

// Normalize the uploaded bytes once: strip EXIF orientation (phone photos carry
// rotation in metadata that raw base64 uploads do not apply), then re-encode to
// JPEG so every rotation retry starts from an upright, uniform source. Falls
// back to the raw bytes when sharp is unavailable (e.g. browser runtimes).
async function normalizeImageBytes(file: File): Promise<{ bytes: Buffer; mimeType: string }> {
  const rawBytes = Buffer.from(await file.arrayBuffer());

  try {
    const { default: sharp } = await import('sharp');
    const normalized = await sharp(rawBytes).rotate().jpeg({ quality: 92 }).toBuffer();
    return { bytes: normalized, mimeType: 'image/jpeg' };
  } catch {
    return { bytes: rawBytes, mimeType: file.type || 'image/png' };
  }
}

async function rotateImageBytes(bytes: Buffer, degrees: number): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  return sharp(bytes).rotate(degrees).jpeg({ quality: 92 }).toBuffer();
}

export async function requestVisionExtraction(apiKey: string, dataUrl: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.5',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract the content in this image and return only a strict Source Notes document in this exact format:',
              'Main Topic: ...',
              'Sub Topic: ...',
              'Sub sub Topic: ...',
              'Examples:',
              '- ...',
              'The page may be photographed sideways or upside down; rotate it mentally and read the upright text.',
              'If the photo shows a two-page book spread, transcribe both pages in reading order.',
              'Preserve tables as bullet lines that pair each row label with its value.',
              'Do not include page numbers, repeated headers, OCR artifacts, or extra explanation.',
            ].join('\n'),
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      max_completion_tokens: 2400,
    }),
    signal: AbortSignal.timeout(maxVisionProviderTimeoutMs),
  });

  if (!response.ok) {
    throw new IngestionError(
      'The vision model could not process the image. Try a sharper image, a clearer scan, or paste the notes manually.',
    );
  }

  const payload = await response.json() as unknown;
  return extractVisionTextPayload(payload);
}

async function defaultImageTextExtractor(file: File): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new IngestionError(
      `"${file.name}" requires OPENAI_API_KEY before the image vision model can extract notes. Configure it and try again.`,
    );
  }

  const { bytes, mimeType } = await normalizeImageBytes(file);

  // Sideways or upside-down page photos are the top cause of empty vision
  // output, so retry with rotated copies before declaring the file unreadable.
  // Keep the budget bounded so a single upload cannot trigger unbounded model
  // spend across a batch of images. Include the full orthogonal rotation set so
  // the model gets one final 270° retry before we surface a clear error.
  const rotationAttempts = [0, 90, 180, 270] as const;
  let extracted = '';
  let sawRotationSupport = true;

  for (const degrees of rotationAttempts) {
    let attemptBytes = bytes;
    if (degrees !== 0) {
      try {
        attemptBytes = await rotateImageBytes(bytes, degrees);
      } catch {
        sawRotationSupport = false;
        break;
      }
    }

    extracted = await requestVisionExtraction(apiKey, await toVisionDataUrl(attemptBytes, mimeType));
    if (!isUnreadableVisionOutput(extracted)) {
      break;
    }

    extracted = '';
  }

  if (!extracted.trim()) {
    throw new IngestionError(
      sawRotationSupport
        ? `"${file.name}" returned no readable text from the vision model, even after rotating it. Try a sharper, upright photo or paste the notes manually.`
        : `"${file.name}" returned no readable text from the vision model. Try a sharper image, a clearer scan, or paste the notes manually.`,
    );
  }

  return formatSourceNotesText(normalizeExtractedText(extracted));
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
      await validateImageFile(file);

      let text: string;
      try {
        text = formatSourceNotesText(normalizeExtractedText(await textExtractor(file)));
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
