import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';

import { previewTransformSchema } from '../api/projects-schema.ts';
import { sourceMindmapGenerationResponseSchema } from '../generation/source-schema.ts';
import { mindmapNodePositionOverridesSchema } from '../mindmap/node-overrides.ts';
import { generatedMindmapSchema } from '../mindmap/schema.ts';

const workspaceDraftStoreName = 'workspace-drafts';
const workspaceDraftKey = 'study-workspace';
const workspaceDbName = 'mindmap-study-app';
const workspaceDbVersion = 1;

export const persistedWorkspaceDraftSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  outline: z.string(),
  rawNotes: z.string().optional(),
  selectedDetailLevel: z.enum(['standard', 'detailed', 'compact', 'plain']).optional(),
  latestDslGeneration: sourceMindmapGenerationResponseSchema.nullable().optional(),
  mindmap: generatedMindmapSchema.nullable(),
  previewTransform: previewTransformSchema,
  nodePositionOverrides: mindmapNodePositionOverridesSchema.optional(),
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

// ---------------------------------------------------------------------------
// Cloud persistence (API-backed, per-project)
// ---------------------------------------------------------------------------

export interface CloudProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type CloudDraft = {
  id: string;
  projectId: string;
  outline: string;
  rawNotes: string;
  selectedDetailLevel: string;
  mindmap: unknown;
  previewTransform: unknown;
  updatedAt: string;
};

export async function getOrCreateActiveProject(): Promise<CloudProject> {
  const listRes = await fetch('/api/projects');

  if (!listRes.ok) {
    throw new Error(`Failed to load projects: ${listRes.status}`);
  }

  const projects = (await listRes.json()) as CloudProject[];

  if (projects.length > 0) {
    return projects[0];
  }

  const createRes = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'My First Project' }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create project: ${createRes.status}`);
  }

  return (await createRes.json()) as CloudProject;
}

export async function loadCloudDraft(projectId: string): Promise<PersistedWorkspaceDraft | null> {
  const res = await fetch(`/api/projects/${projectId}/draft`);

  if (!res.ok) {
    return null;
  }

  const raw = await res.json();

  if (!raw) {
    return null;
  }

  return parsePersistedWorkspaceDraft({
    version: 1,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    outline: raw.outline ?? '',
    rawNotes: raw.rawNotes ?? '',
    selectedDetailLevel: raw.selectedDetailLevel ?? 'standard',
    latestDslGeneration: null,
    mindmap: raw.mindmap ?? null,
    previewTransform: raw.previewTransform ?? { scale: 1, translateX: 0, translateY: 0 },
    nodePositionOverrides: raw.nodePositionOverrides ?? undefined,
  });
}

export async function saveCloudDraft(
  projectId: string,
  draft: PersistedWorkspaceDraft,
): Promise<boolean> {
  const res = await fetch(`/api/projects/${projectId}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outline: draft.outline,
      rawNotes: draft.rawNotes ?? '',
      selectedDetailLevel: draft.selectedDetailLevel ?? 'standard',
      mindmap: draft.mindmap,
      previewTransform: draft.previewTransform,
      nodePositionOverrides: draft.nodePositionOverrides ?? null,
    }),
  });

  return res.ok;
}

export async function recordGenerationHistory(
  projectId: string,
  entry: {
    detailLevel: string;
    dsl: string;
    densityStatus: string;
    nodeCount: number;
    rawNotes: string;
  },
): Promise<void> {
  await fetch(`/api/projects/${projectId}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
}