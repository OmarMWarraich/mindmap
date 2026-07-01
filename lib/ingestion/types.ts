// The ingestion layer normalizes any attached file into plain text, which then
// feeds the existing Source Notes → /api/generation/dsl pipeline. This is the
// shared contract that the PDF and image adapters build on.

export interface IngestedFileMeta {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  /** Number of pages, for paged formats (e.g. PDF). Omitted for plain text. */
  pageCount?: number;
}

export interface IngestedFile {
  text: string;
  meta: IngestedFileMeta;
}

export interface IngestionAdapter {
  /** Stable identifier, used in errors/telemetry. */
  id: string;
  /** Lower-case file extensions this adapter handles, without the dot. */
  extensions: string[];
  /** MIME types this adapter handles (secondary — some types, e.g. .md, are unreliable). */
  mimeTypes: string[];
  read(file: File): Promise<IngestedFile>;
}

/**
 * Thrown for guard failures (unsupported type, too large) so the UI can surface
 * `error.message` directly. Distinct class so callers can tell an expected
 * ingestion rejection from an unexpected runtime error.
 */
export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionError';
  }
}
