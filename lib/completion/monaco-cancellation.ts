export function isIgnorableMonacoCancellation(reason: unknown): boolean {
  const details = getCancellationDetails(reason);

  if (!details.isCanceled) {
    return false;
  }

  if (details.stackIncludesMonaco) {
    return true;
  }

  return details.name === 'Canceled';
}

function getCancellationDetails(reason: unknown): {
  name: string;
  message: string;
  stack: string;
  isCanceled: boolean;
  stackIncludesMonaco: boolean;
} {
  if (typeof reason === 'string') {
    return buildCancellationDetails('', reason, '');
  }

  if (!reason || typeof reason !== 'object') {
    return buildCancellationDetails('', '', '');
  }

  const candidate = reason as {
    name?: unknown;
    message?: unknown;
    stack?: unknown;
  };

  return buildCancellationDetails(
    typeof candidate.name === 'string' ? candidate.name : '',
    typeof candidate.message === 'string' ? candidate.message : '',
    typeof candidate.stack === 'string' ? candidate.stack : '',
  );
}

function buildCancellationDetails(
  name: string,
  message: string,
  stack: string,
): {
  name: string;
  message: string;
  stack: string;
  isCanceled: boolean;
  stackIncludesMonaco: boolean;
} {
  const normalizedMessage = message.trim();
  const normalizedName = name.trim();
  const normalizedStack = stack.trim();
  const lowerName = normalizedName.toLowerCase();
  const lowerMessage = normalizedMessage.toLowerCase();
  const isCanceled =
    lowerName === 'canceled' ||
    lowerName === 'cancelled' ||
    lowerName === 'aborterror' ||
    normalizedMessage === 'Canceled' ||
    normalizedMessage === 'Cancelled' ||
    normalizedMessage === 'AbortError' ||
    normalizedMessage.startsWith('Canceled:') ||
    normalizedMessage.startsWith('Cancelled:') ||
    normalizedMessage.startsWith('AbortError:') ||
    lowerMessage.includes('aborted') ||
    lowerMessage.includes('canceled') ||
    lowerMessage.includes('cancelled');

  return {
    name: normalizedName,
    message: normalizedMessage,
    stack: normalizedStack,
    isCanceled,
    stackIncludesMonaco:
      normalizedStack.includes('monaco-editor') ||
      normalizedStack.includes('editor.api-'),
  };
}