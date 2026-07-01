import type { IngestedFile, IngestionAdapter } from './types.ts';

// Plain-text and Markdown files are read as-is (UTF-8). Markdown syntax is left
// intact — the generation model handles it, and stripping it would lose the
// structural cues (headings, bullets) that help hierarchy detection.
export const textIngestionAdapter: IngestionAdapter = {
  id: 'text',
  extensions: ['txt', 'md', 'markdown', 'text'],
  mimeTypes: ['text/plain', 'text/markdown', 'text/x-markdown'],
  async read(file: File): Promise<IngestedFile> {
    const text = await file.text();

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
