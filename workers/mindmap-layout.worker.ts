import {
  layoutMindmapWithElk,
  type MindmapLayoutWorkerRequest,
  type MindmapLayoutWorkerResponse,
} from '../lib/mindmap/layout.ts';

self.onmessage = async (event: MessageEvent<MindmapLayoutWorkerRequest>) => {
  if (event.data.type !== 'layout') {
    return;
  }

  try {
    const result = await layoutMindmapWithElk(event.data.mindmap);
    const response: MindmapLayoutWorkerResponse = {
      type: 'layout-success',
      requestId: event.data.requestId,
      result,
    };

    self.postMessage(response);
  } catch (error) {
    const response: MindmapLayoutWorkerResponse = {
      type: 'layout-error',
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : 'Unknown ELK layout failure.',
    };

    self.postMessage(response);
  }
};