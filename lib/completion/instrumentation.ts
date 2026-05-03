import { z } from 'zod';

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

const inlineCompletionEventLog: InlineCompletionEvent[] = [];

export function recordInlineCompletionEvent(event: InlineCompletionEvent): void {
  inlineCompletionEventLog.push(event);
}

export function getInlineCompletionEventLogForTests(): InlineCompletionEvent[] {
  return [...inlineCompletionEventLog];
}

export function resetInlineCompletionEventLogForTests(): void {
  inlineCompletionEventLog.length = 0;
}