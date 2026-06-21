// Robust JSON extraction for model responses. Native structured-output models
// (`response_format` / forced tool use) return clean JSON, but `prompt`-strategy
// models — which lack a native mechanism — tend to wrap the JSON in Markdown code
// fences or surround it with prose. This tries, in order: a direct parse, the
// contents of the first fenced block, and the first balanced `{...}`/`[...]`
// region, so the same parse path works regardless of how the model framed it.
export function parseStructuredModelJson(text: string): unknown {
  let lastError: unknown;

  for (const candidate of collectJsonCandidates(text)) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? `: ${lastError.message}` : '';
  throw new Error(`Model response did not contain parseable JSON${detail}`);
}

function collectJsonCandidates(text: string): string[] {
  const trimmed = text.trim();
  const candidates: string[] = [];

  const add = (value: string | null): void => {
    if (value && value.length > 0 && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  add(trimmed);
  const fenced = extractFencedBlock(trimmed);
  add(fenced);
  add(extractBalancedJson(fenced ?? trimmed));

  return candidates;
}

function extractFencedBlock(text: string): string | null {
  // First ```...``` block, optional language tag (```json). Non-greedy body.
  const match = /```[a-zA-Z0-9-]*\s*\n?([\s\S]*?)```/u.exec(text);
  return match ? match[1].trim() : null;
}

function extractBalancedJson(text: string): string | null {
  const start = firstJsonOpenIndex(text);

  if (start === -1) {
    return null;
  }

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function firstJsonOpenIndex(text: string): number {
  const objectIndex = text.indexOf('{');
  const arrayIndex = text.indexOf('[');

  if (objectIndex === -1) {
    return arrayIndex;
  }

  if (arrayIndex === -1) {
    return objectIndex;
  }

  return Math.min(objectIndex, arrayIndex);
}
