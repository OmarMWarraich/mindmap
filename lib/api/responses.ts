// Single source for the JSON error-response shape used across API routes, so the
// 401/404/4xx/5xx contract is defined in one place instead of hand-rolled per
// handler.

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function unauthorized(): Response {
  return errorResponse('Unauthorized', 401);
}

export function notFound(message = 'Not found'): Response {
  return errorResponse(message, 404);
}
