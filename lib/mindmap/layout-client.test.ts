import assert from 'node:assert/strict';
import test from 'node:test';

import { createMindmapLayoutClient } from './layout-client.ts';
import type { MindmapLayoutResult, MindmapLayoutWorkerRequest } from './layout.ts';
import { validGeneratedMindmapFixture } from './__fixtures__/generatedMindmap.ts';

const workerResult: MindmapLayoutResult = { width: 100, height: 80, nodes: [], edges: [] };
const mainThreadResult: MindmapLayoutResult = { width: 1, height: 1, nodes: [], edges: [] };

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly posted: MindmapLayoutWorkerRequest[] = [];
  terminated = false;

  postMessage(request: MindmapLayoutWorkerRequest): void {
    this.posted.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  private lastRequestId(): number {
    return this.posted[this.posted.length - 1]!.requestId;
  }

  respondSuccess(result: MindmapLayoutResult, requestId = this.lastRequestId()): void {
    this.onmessage?.({ data: { type: 'layout-success', requestId, result } } as MessageEvent);
  }

  respondError(message: string, requestId = this.lastRequestId()): void {
    this.onmessage?.({ data: { type: 'layout-error', requestId, message } } as MessageEvent);
  }

  emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function rejectingMainThread(): Promise<MindmapLayoutResult> {
  return Promise.reject(new Error('main-thread layout should not run on the worker path'));
}

test('layout returns the worker result without touching the main thread', async () => {
  const fakeWorker = new FakeWorker();
  const client = createMindmapLayoutClient({
    createWorker: () => fakeWorker,
    layoutOnMainThread: rejectingMainThread,
  });

  const pending = client.layout(validGeneratedMindmapFixture);
  fakeWorker.respondSuccess(workerResult);
  const outcome = await pending;

  assert.equal(outcome.transport, 'worker');
  assert.equal(outcome.result, workerResult);
  assert.equal(outcome.fallbackReason, undefined);
  assert.equal(fakeWorker.posted.length, 1);
  assert.equal(fakeWorker.posted[0]?.type, 'layout');
});

test('layout reuses a single worker across requests', async () => {
  let created = 0;
  const fakeWorker = new FakeWorker();
  const client = createMindmapLayoutClient({
    createWorker: () => {
      created += 1;
      return fakeWorker;
    },
    layoutOnMainThread: rejectingMainThread,
  });

  const first = client.layout(validGeneratedMindmapFixture);
  fakeWorker.respondSuccess(workerResult);
  await first;

  const second = client.layout(validGeneratedMindmapFixture);
  fakeWorker.respondSuccess(workerResult);
  await second;

  assert.equal(created, 1);
  assert.equal(fakeWorker.posted.length, 2);
});

test('a worker layout-error rejects instead of silently falling back', async () => {
  const fakeWorker = new FakeWorker();
  const client = createMindmapLayoutClient({
    createWorker: () => fakeWorker,
    layoutOnMainThread: rejectingMainThread,
  });

  const pending = client.layout(validGeneratedMindmapFixture);
  fakeWorker.respondError('ELK could not lay out the graph');

  await assert.rejects(pending, /ELK could not lay out the graph/);
});

test('a worker error event falls back to the main thread', async () => {
  const fakeWorker = new FakeWorker();
  const client = createMindmapLayoutClient({
    createWorker: () => fakeWorker,
    layoutOnMainThread: async () => mainThreadResult,
  });

  const pending = client.layout(validGeneratedMindmapFixture);
  fakeWorker.emitError('worker crashed');
  const outcome = await pending;

  assert.equal(outcome.transport, 'main-thread');
  assert.equal(outcome.result, mainThreadResult);
  assert.match(outcome.fallbackReason ?? '', /worker crashed/);
  assert.equal(fakeWorker.terminated, true);
});

test('a worker timeout falls back to the main thread', async () => {
  const fakeWorker = new FakeWorker();
  const client = createMindmapLayoutClient({
    createWorker: () => fakeWorker,
    layoutOnMainThread: async () => mainThreadResult,
    timeoutMs: 5,
  });

  // Never respond: let the timeout fire.
  const outcome = await client.layout(validGeneratedMindmapFixture);

  assert.equal(outcome.transport, 'main-thread');
  assert.equal(outcome.result, mainThreadResult);
  assert.match(outcome.fallbackReason ?? '', /timed out/);
  assert.equal(fakeWorker.terminated, true);
});

test('a worker constructor failure falls back to the main thread', async () => {
  const client = createMindmapLayoutClient({
    createWorker: () => {
      throw new Error('worker bundle missing');
    },
    layoutOnMainThread: async () => mainThreadResult,
  });

  const outcome = await client.layout(validGeneratedMindmapFixture);

  assert.equal(outcome.transport, 'main-thread');
  assert.equal(outcome.result, mainThreadResult);
  assert.match(outcome.fallbackReason ?? '', /worker bundle missing/);
});

test('environments without Web Workers use the main thread', async () => {
  // The Node test runtime has no DOM Worker; this is the real SSR/fallback path.
  assert.equal(typeof Worker, 'undefined');

  const client = createMindmapLayoutClient({
    layoutOnMainThread: async () => mainThreadResult,
  });

  const outcome = await client.layout(validGeneratedMindmapFixture);

  assert.equal(outcome.transport, 'main-thread');
  assert.equal(outcome.result, mainThreadResult);
  assert.match(outcome.fallbackReason ?? '', /unavailable/);
});
