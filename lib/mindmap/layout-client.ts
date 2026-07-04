import {
  layoutMindmapWithElk,
  type MindmapLayoutResult,
  type MindmapLayoutWorkerRequest,
  type MindmapLayoutWorkerResponse,
} from './layout.ts';
import type { GeneratedMindmap } from './schema.ts';
import {
  formatLayoutWorkerErrorEvent,
  formatLayoutWorkerMessageErrorEvent,
  layoutWorkerTimeoutMs,
} from './worker-diagnostics.ts';

/**
 * The slice of the DOM `Worker` API the client actually uses. Narrowing it keeps
 * the client decoupled from the full lib.dom surface and lets tests supply a
 * lightweight fake without casting.
 */
export interface LayoutWorker {
  onmessage: ((event: MessageEvent<MindmapLayoutWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: MindmapLayoutWorkerRequest): void;
  terminate(): void;
}

export type LayoutTransport = 'worker' | 'main-thread';

export interface MindmapLayoutClientResult {
  result: MindmapLayoutResult;
  /** Which path produced the layout: the worker, or the main-thread fallback. */
  transport: LayoutTransport;
  elapsedMs: number;
  /**
   * Set only when the worker path was attempted but the client fell back to the
   * main thread (unsupported environment, worker error, or timeout). Genuine ELK
   * layout failures reject instead — re-running them on the main thread would only
   * block the UI to fail identically.
   */
  fallbackReason?: string;
}

export interface MindmapLayoutClientDeps {
  /** Create the layout worker. Defaults to the bundled mindmap layout worker. */
  createWorker?: () => LayoutWorker;
  /** Main-thread layout used for fallback. Defaults to {@link layoutMindmapWithElk}. */
  layoutOnMainThread?: (mindmap: GeneratedMindmap) => Promise<MindmapLayoutResult>;
  /** Per-request worker timeout. Defaults to {@link layoutWorkerTimeoutMs}. */
  timeoutMs?: number;
  /** Monotonic clock for elapsed timing. Defaults to performance.now/Date.now. */
  now?: () => number;
}

export interface MindmapLayoutClient {
  layout(mindmap: GeneratedMindmap): Promise<MindmapLayoutClientResult>;
}

type WorkerAttempt =
  | { kind: 'response'; response: MindmapLayoutWorkerResponse }
  | { kind: 'transport-failure'; reason: string };

interface PendingRequest {
  settle: (attempt: WorkerAttempt) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

const unsupportedEnvironmentReason = 'Web Workers are unavailable in this environment.';

// Statically analyzable so Turbopack/webpack bundle the worker. `new Worker(new
// URL(..., import.meta.url))` is the supported off-main-thread pattern; the
// expression is only evaluated in the browser (guarded by resolveCreateWorker).
function createMindmapLayoutWorker(): LayoutWorker {
  return new Worker(new URL('../../workers/mindmap-layout.worker.ts', import.meta.url), {
    type: 'module',
  });
}

function resolveCreateWorker(
  provided: MindmapLayoutClientDeps['createWorker'],
): (() => LayoutWorker) | null {
  if (provided) {
    return provided;
  }

  // No injected factory: only reach for the bundled worker where the runtime
  // actually supports it (the browser). On the server there is no main thread to
  // protect, so every request takes the main-thread path.
  return typeof Worker === 'undefined' ? null : createMindmapLayoutWorker;
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown layout worker failure.';
}

/**
 * Off-main-thread layout transport. Reuses a single worker across requests,
 * correlating replies by request id, and recreates it after a fatal error or
 * timeout. Any transport failure falls back to a per-request main-thread layout,
 * so callers always receive a valid result.
 */
export function createMindmapLayoutClient(deps: MindmapLayoutClientDeps = {}): MindmapLayoutClient {
  const layoutOnMainThread = deps.layoutOnMainThread ?? layoutMindmapWithElk;
  const timeoutMs = deps.timeoutMs ?? layoutWorkerTimeoutMs;
  const now = deps.now ?? defaultNow;
  const createWorker = resolveCreateWorker(deps.createWorker);

  let worker: LayoutWorker | null = null;
  let nextRequestId = 0;
  // Carries a worker-construction failure from ensureWorker() back to the caller,
  // which turns it into a main-thread fallback reason.
  let pendingConstructorError: string | null = null;
  const pending = new Map<number, PendingRequest>();

  function discardWorker(): void {
    if (!worker) {
      return;
    }

    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    try {
      worker.terminate();
    } catch {
      // Worker already gone — nothing to release.
    }
    worker = null;
  }

  // A wedged or crashed worker drags every queued request down with it (ELK runs
  // them on one thread), so a single fatal signal fails them all and forces a
  // fresh worker on the next request.
  function failAllPending(reason: string): void {
    discardWorker();
    const entries = [...pending.values()];
    pending.clear();
    for (const entry of entries) {
      clearTimeout(entry.timeoutHandle);
      entry.settle({ kind: 'transport-failure', reason });
    }
  }

  function ensureWorker(): LayoutWorker | null {
    if (worker) {
      return worker;
    }
    if (!createWorker) {
      return null;
    }

    try {
      worker = createWorker();
    } catch (error) {
      worker = null;
      pendingConstructorError = describeError(error);
      return null;
    }

    worker.onmessage = (event: MessageEvent<MindmapLayoutWorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.requestId);
      if (!entry) {
        return;
      }

      pending.delete(response.requestId);
      clearTimeout(entry.timeoutHandle);
      entry.settle({ kind: 'response', response });
    };
    worker.onerror = (event: ErrorEvent) => failAllPending(formatLayoutWorkerErrorEvent(event));
    worker.onmessageerror = (event: MessageEvent) =>
      failAllPending(formatLayoutWorkerMessageErrorEvent(event));

    return worker;
  }

  function attemptWorkerLayout(mindmap: GeneratedMindmap): Promise<WorkerAttempt> {
    pendingConstructorError = null;
    const activeWorker = ensureWorker();
    if (!activeWorker) {
      return Promise.resolve({
        kind: 'transport-failure',
        reason: pendingConstructorError ?? unsupportedEnvironmentReason,
      });
    }

    const requestId = nextRequestId;
    nextRequestId += 1;

    return new Promise<WorkerAttempt>((resolve) => {
      const timeoutHandle = setTimeout(() => {
        failAllPending(`Layout worker timed out after ${timeoutMs}ms.`);
      }, timeoutMs);

      pending.set(requestId, { settle: resolve, timeoutHandle });

      try {
        const request: MindmapLayoutWorkerRequest = { type: 'layout', requestId, mindmap };
        activeWorker.postMessage(request);
      } catch (error) {
        pending.delete(requestId);
        clearTimeout(timeoutHandle);
        discardWorker();
        resolve({ kind: 'transport-failure', reason: describeError(error) });
      }
    });
  }

  async function layout(mindmap: GeneratedMindmap): Promise<MindmapLayoutClientResult> {
    const startedAt = now();
    const attempt = await attemptWorkerLayout(mindmap);

    if (attempt.kind === 'response') {
      const { response } = attempt;
      if (response.type === 'layout-success') {
        return {
          result: response.result,
          transport: 'worker',
          elapsedMs: Math.max(0, now() - startedAt),
        };
      }

      // The worker ran ELK and it threw: a genuine layout failure, not a transport
      // problem. Surface it so the caller can show an error state.
      throw new Error(response.message);
    }

    const result = await layoutOnMainThread(mindmap);
    return {
      result,
      transport: 'main-thread',
      elapsedMs: Math.max(0, now() - startedAt),
      fallbackReason: attempt.reason,
    };
  }

  return { layout };
}

let sharedClient: MindmapLayoutClient | null = null;

/** Process-wide layout client used by the workspace. Created lazily. */
export function getMindmapLayoutClient(): MindmapLayoutClient {
  sharedClient ??= createMindmapLayoutClient();
  return sharedClient;
}

/** Reset the shared client between tests. */
export function resetMindmapLayoutClientForTests(): void {
  sharedClient = null;
}
