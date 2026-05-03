export const layoutWorkerTimeoutMs = 4_000;

export interface LayoutWorkerDiagnostics {
  phase:
    | 'idle'
    | 'initializing'
    | 'posting'
    | 'main-thread'
    | 'ready'
    | 'unsupported'
    | 'constructor-error'
    | 'worker-error'
    | 'message-error'
    | 'response-error'
    | 'timeout';
  summary: string;
  detail?: string;
  requestId?: number;
  elapsedMs?: number;
}

export function formatLayoutWorkerErrorEvent(event: ErrorEvent): string {
  const segments = [event.message || 'Unknown worker error'];

  if (event.filename) {
    const location = [event.lineno, event.colno].filter((value) => value > 0).join(':');
    segments.push(location ? `${event.filename}:${location}` : event.filename);
  }

  return segments.join(' at ');
}

export function formatLayoutWorkerMessageErrorEvent(event: MessageEvent): string {
  const dataType = describeMessageData(event.data);
  return `Worker message could not be deserialized${dataType ? ` (${dataType})` : ''}.`;
}

export function createLayoutWorkerTimeoutDiagnostics(
  requestId: number,
  elapsedMs: number,
): LayoutWorkerDiagnostics {
  return {
    phase: 'timeout',
    summary: `Layout worker timed out after ${elapsedMs}ms.`,
    detail: 'The worker accepted the request but never returned a layout result or error.',
    requestId,
    elapsedMs,
  };
}

function describeMessageData(data: unknown): string | null {
  if (data == null) {
    return null;
  }

  if (Array.isArray(data)) {
    return 'array payload';
  }

  if (typeof data === 'object') {
    const constructorName = (data as { constructor?: { name?: string } }).constructor?.name;
    return constructorName ? `${constructorName} payload` : 'object payload';
  }

  return `${typeof data} payload`;
}