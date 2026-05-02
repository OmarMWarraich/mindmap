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
      result,
    };

    self.postMessage(response);
  } catch (error) {
    const response: MindmapLayoutWorkerResponse = {
      type: 'layout-error',
      message: error instanceof Error ? error.message : 'Unknown ELK layout failure.',
    };

    self.postMessage(response);
  }
};