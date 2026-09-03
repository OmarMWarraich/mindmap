import { convertNormalizedTextSourceNotesFormat } from './ocr-normalizer.ts';
import { IngestionError, type IngestedFile, type IngestionAdapter } from './types.ts';

export type ImageTextExtractor = (file: File) => Promise<string>;

export interface ImageIngestionAdapterOptions {
  /** Preferred path: LLM vision extraction when a model is available. OCR is the fallback for files that do not carry model-backed extraction. */
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

function formatSourceNotesText(text: string): string {
  if (!text.trim() || !looksLikeRawOcrNoise(text)) {
    return text;
  }

  const formatted = convertNormalizedTextSourceNotesFormat(text);
  return formatted || text;
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

async function defaultImageTextExtractor(file: File): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new IngestionError(
      `"${file.name}" requires OPENAI_API_KEY before the image vision model can extract notes. Configure it and try again.`,
    );
  }

  const blob = await file.arrayBuffer();
  const bytes = new Uint8Array(blob);
  const dataUrl = `data:${file.type || 'image/png'};base64,${Buffer.from(bytes).toString('base64')}`;

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
              'Do not include page numbers, repeated headers, OCR artifacts, or extra explanation.',
            ].join('\n'),
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      max_completion_tokens: 1200,
    }),
  });

  if (!response.ok) {
    throw new IngestionError(
      `"${file.name}" could not be read with the vision model. Try a sharper image, a clearer scan, or paste the notes manually.`,
    );
  }

  const payload = await response.json() as unknown;
  const extracted = extractVisionTextPayload(payload);
  if (!extracted.trim()) {
    throw new IngestionError(
      `"${file.name}" returned no readable text from the vision model.`,
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
