import { z } from 'zod';

import { getCompletionTelemetryStore } from './telemetry-store.ts';

export const inlineCompletionEventSchema = z.object({
  correlationId: z.string().min(1),
  outcome: z.enum(['accepted', 'dismissed', 'ignored']),
  outlineLength: z.number().int().nonnegative(),
  requestReason: z.string(),
  shownDurationMs: z.number().nonnegative(),
  source: z.literal('model'),
  suggestionText: z.string(),
}).strict();

export type InlineCompletionEvent = z.infer<typeof inlineCompletionEventSchema>;

// Persists a telemetry event for the given user via the configured telemetry store.
// Privacy: the raw suggestion text is never stored — only its length — since it can
// echo the user's notes.
export async function recordInlineCompletionEvent(
  event: InlineCompletionEvent,
  userId: string,
): Promise<void> {
  await getCompletionTelemetryStore().record({
    userId,
    correlationId: event.correlationId,
    outcome: event.outcome,
    source: event.source,
    requestReason: event.requestReason,
    outlineLength: event.outlineLength,
    suggestionLength: event.suggestionText.length,
    shownDurationMs: Math.round(event.shownDurationMs),
  });
}
