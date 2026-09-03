import { withUser } from '../../../lib/api/guards.ts';
import { errorResponse } from '../../../lib/api/responses.ts';
import { ingestFiles } from '../../../lib/ingestion/ingest.ts';

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

    const result = await ingestFiles(files);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected upload failure.';
    return errorResponse(message, 500);
  }
});
