import { db as defaultDb } from '../db/index.ts';
import { completionEvents } from '../db/schema.ts';

// What gets persisted. The raw suggestion text is deliberately absent — only its
// length is kept, since a suggestion can echo the user's notes.
export interface PersistedCompletionEvent {
  userId: string;
  correlationId: string;
  outcome: string;
  source: string;
  requestReason: string;
  outlineLength: number;
  suggestionLength: number;
  shownDurationMs: number;
}

export interface CompletionTelemetryStore {
  record(event: PersistedCompletionEvent): Promise<void>;
}

export interface InMemoryCompletionTelemetryStore extends CompletionTelemetryStore {
  entries(): PersistedCompletionEvent[];
  clear(): void;
}

// Local/test sink: keeps events in memory and exposes them for assertions.
export function createInMemoryCompletionTelemetryStore(): InMemoryCompletionTelemetryStore {
  const events: PersistedCompletionEvent[] = [];

  return {
    async record(event) {
      events.push(event);
    },
    entries() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
  };
}

// Durable sink: appends to the completion_event table.
export function createDrizzleCompletionTelemetryStore(
  database: typeof defaultDb = defaultDb,
): CompletionTelemetryStore {
  return {
    async record(event) {
      await database.insert(completionEvents).values(event);
    },
  };
}

let cachedStore: CompletionTelemetryStore | null = null;

// Process-wide singleton. Defaults to the durable Drizzle sink; the database is always
// configured, so (unlike rate limiting) there is no in-memory production fallback.
export function getCompletionTelemetryStore(): CompletionTelemetryStore {
  if (!cachedStore) {
    cachedStore = createDrizzleCompletionTelemetryStore();
  }

  return cachedStore;
}

export function setCompletionTelemetryStoreForTests(store: CompletionTelemetryStore): void {
  cachedStore = store;
}

export function resetCompletionTelemetryStoreForTests(): void {
  cachedStore = null;
}
