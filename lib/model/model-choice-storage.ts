import { z } from 'zod';

import { knownModelIdSchema } from './catalog.ts';

/**
 * Persisted per-role model selections. Stored in `localStorage` for the MVP so a
 * user's completion/generation model picks survive reloads. Each id is validated
 * against the live catalog on read; an id that has since been removed (or any
 * corrupt value) is dropped to `undefined` so the server falls back to the
 * per-role default rather than failing.
 */
export const modelChoicesSchema = z
  .object({
    completionModelId: knownModelIdSchema.optional().catch(undefined),
    generationModelId: knownModelIdSchema.optional().catch(undefined),
  })
  .catch({ completionModelId: undefined, generationModelId: undefined });

export type ModelChoices = z.infer<typeof modelChoicesSchema>;

export const MODEL_CHOICES_STORAGE_KEY = 'mindmap:model-choices';

const EMPTY_CHOICES: ModelChoices = {
  completionModelId: undefined,
  generationModelId: undefined,
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }

  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Accessing localStorage can throw (e.g. disabled cookies / sandboxed iframe).
    return null;
  }
}

export function loadModelChoices(storage?: StorageLike): ModelChoices {
  const store = resolveStorage(storage);

  if (!store) {
    return { ...EMPTY_CHOICES };
  }

  let raw: string | null;
  try {
    raw = store.getItem(MODEL_CHOICES_STORAGE_KEY);
  } catch {
    return { ...EMPTY_CHOICES };
  }

  if (!raw) {
    return { ...EMPTY_CHOICES };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...EMPTY_CHOICES };
  }

  return modelChoicesSchema.parse(parsed);
}

export function saveModelChoices(choices: ModelChoices, storage?: StorageLike): void {
  const store = resolveStorage(storage);

  if (!store) {
    return;
  }

  const payload: Record<string, string> = {};
  if (choices.completionModelId) {
    payload.completionModelId = choices.completionModelId;
  }
  if (choices.generationModelId) {
    payload.generationModelId = choices.generationModelId;
  }

  try {
    if (Object.keys(payload).length === 0) {
      store.removeItem(MODEL_CHOICES_STORAGE_KEY);
      return;
    }

    store.setItem(MODEL_CHOICES_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or availability failures are non-fatal for a UI preference.
  }
}
