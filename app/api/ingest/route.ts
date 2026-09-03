import { withUser } from '../../../lib/api/guards.ts';
import { errorResponse } from '../../../lib/api/responses.ts';
import { ingestFiles } from '../../../lib/ingestion/ingest.ts';
import { MAX_FILES_PER_UPLOAD, MAX_TOTAL_UPLOAD_BYTES } from '../../../lib/ingestion/upload-constraints.ts';

export const runtime = 'nodejs';

export const POST = withUser(async (req) => {
  try {
    const formData = await req.formData();
    const fileValues = formData.getAll('files');
    const fileCandidates = fileValues.length > 0 ? fileValues : [formData.get('file')].filter(Boolean);
    const files = fileCandidates.filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return errorResponse('No files were uploaded.', 400);
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return errorResponse(`You can upload up to ${MAX_FILES_PER_UPLOAD} files at a time.`, 400);
    }

    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      return errorResponse(
        `The total upload size is too large. Keep the batch under ${Math.round(MAX_TOTAL_UPLOAD_BYTES / (1024 * 1024))} MB before attaching.`,
        400,
      );
    }

    const result = await ingestFiles(files);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected upload failure.';
    return errorResponse(message, 500);
  }
});
