import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';

import { generatedMindmapSchema } from '../mindmap/schema.ts';

const workspaceDraftStoreName = 'workspace-drafts';
const workspaceDraftKey = 'study-workspace';
const workspaceDbName = 'mindmap-study-app';
const workspaceDbVersion = 1;

const svgPreviewTransformSchema = z.object({
  scale: z.number().positive(),
  translateX: z.number(),
  translateY: z.number(),
}).strict();

export const persistedWorkspaceDraftSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  outline: z.string(),
  mindmap: generatedMindmapSchema.nullable(),
  previewTransform: svgPreviewTransformSchema,
}).strict();

export type PersistedWorkspaceDraft = z.infer<typeof persistedWorkspaceDraftSchema>;

interface MindmapWorkspaceDb extends DBSchema {
  [workspaceDraftStoreName]: {
    key: string;
    value: PersistedWorkspaceDraft;
  };
}

let workspaceDbPromise: Promise<IDBPDatabase<MindmapWorkspaceDb>> | null = null;

export async function loadWorkspaceDraft(): Promise<PersistedWorkspaceDraft | null> {
  const db = await getWorkspaceDb();

  if (!db) {
    return null;
  }

  const value = await db.get(workspaceDraftStoreName, workspaceDraftKey);
  return value ? parsePersistedWorkspaceDraft(value) : null;
}

export async function saveWorkspaceDraft(draft: PersistedWorkspaceDraft): Promise<boolean> {
  const db = await getWorkspaceDb();

  if (!db) {
    return false;
  }

  const parsedDraft = persistedWorkspaceDraftSchema.parse(draft);
  await db.put(workspaceDraftStoreName, parsedDraft, workspaceDraftKey);
  return true;
}

export function parsePersistedWorkspaceDraft(value: unknown): PersistedWorkspaceDraft | null {
  const result = persistedWorkspaceDraftSchema.safeParse(value);
  return result.success ? result.data : null;
}

async function getWorkspaceDb(): Promise<IDBPDatabase<MindmapWorkspaceDb> | null> {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  if (!workspaceDbPromise) {
    workspaceDbPromise = openDB<MindmapWorkspaceDb>(workspaceDbName, workspaceDbVersion, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(workspaceDraftStoreName)) {
          db.createObjectStore(workspaceDraftStoreName);
        }
      },
    });
  }

  return workspaceDbPromise;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}