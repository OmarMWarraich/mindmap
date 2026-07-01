import { maxSourceTextCharacters } from '../generation/limits.ts';
import { textIngestionAdapter } from './text-adapter.ts';
import { IngestionError, type IngestedFile, type IngestionAdapter } from './types.ts';

// Registry of available adapters. New input types (PDF, images) register here.
const ingestionAdapters: IngestionAdapter[] = [textIngestionAdapter];

// Refuse to even read absurdly large files. The character cap
// (maxSourceTextCharacters) is the meaningful limit — this is a coarse guard so
// we never pull a huge blob into memory first.
const maxIngestionBytes = 5 * 1024 * 1024;

/** Accepted extensions across all adapters, for the file input's `accept` attribute. */
export const acceptedIngestionExtensions: string[] = ingestionAdapters.flatMap(
  (adapter) => adapter.extensions,
);

export interface MultiIngestionResult {
  /** Concatenated text of all successfully ingested files, in selection order. */
  text: string;
  ingested: IngestedFile[];
  errors: Array<{ fileName: string; message: string }>;
}

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

// Match by extension first; MIME is only a fallback because some types (notably
// .md) are reported inconsistently or as an empty string across browsers.
function selectAdapter(file: File): IngestionAdapter | null {
  const extension = fileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  return (
    ingestionAdapters.find(
      (adapter) =>
        adapter.extensions.includes(extension)
        || (mimeType !== '' && adapter.mimeTypes.includes(mimeType)),
    ) ?? null
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Convert a single attached file to plain text, enforcing type and size guards.
 * Throws IngestionError (with a user-facing message) on any guard failure.
 */
export async function ingestFile(file: File): Promise<IngestedFile> {
  if (file.size > maxIngestionBytes) {
    throw new IngestionError(
      `"${file.name}" is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(maxIngestionBytes)}.`,
    );
  }

  const adapter = selectAdapter(file);
  if (!adapter) {
    throw new IngestionError(
      `"${file.name}" is not a supported file type. Attach a .txt or .md file.`,
    );
  }

  const ingested = await adapter.read(file);

  if (ingested.text.trim().length === 0) {
    throw new IngestionError(`"${file.name}" appears to be empty.`);
  }

  if (ingested.text.length > maxSourceTextCharacters) {
    throw new IngestionError(
      `"${file.name}" has too much text (${ingested.text.length.toLocaleString()} characters). `
        + `Maximum is ${maxSourceTextCharacters.toLocaleString()}.`,
    );
  }

  return ingested;
}

/**
 * Ingest multiple files, concatenating the successful ones (blank-line separated)
 * and collecting per-file errors. One bad file never blocks the others.
 */
export async function ingestFiles(files: FileList | File[]): Promise<MultiIngestionResult> {
  const ingested: IngestedFile[] = [];
  const errors: Array<{ fileName: string; message: string }> = [];

  for (const file of Array.from(files)) {
    try {
      ingested.push(await ingestFile(file));
    } catch (error) {
      errors.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : 'Failed to read file.',
      });
    }
  }

  return {
    text: ingested.map((item) => item.text).join('\n\n'),
    ingested,
    errors,
  };
}
