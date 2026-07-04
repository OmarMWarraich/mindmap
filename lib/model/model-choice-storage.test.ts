import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MODEL_CHOICES_STORAGE_KEY,
  loadModelChoices,
  saveModelChoices,
} from './model-choice-storage.ts';

function createStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    raw: map,
  };
}

test('loadModelChoices returns empty choices when nothing is stored', () => {
  const storage = createStorage();
  assert.deepEqual(loadModelChoices(storage), {
    completionModelId: undefined,
    generationModelId: undefined,
  });
});

test('saveModelChoices then loadModelChoices round-trips known ids', () => {
  const storage = createStorage();
  saveModelChoices(
    { completionModelId: 'gpt-5.4', generationModelId: 'claude-sonnet-4-5' },
    storage,
  );

  assert.deepEqual(loadModelChoices(storage), {
    completionModelId: 'gpt-5.4',
    generationModelId: 'claude-sonnet-4-5',
  });
});

test('saveModelChoices omits undefined fields from the stored payload', () => {
  const storage = createStorage();
  saveModelChoices({ completionModelId: 'gpt-5.4', generationModelId: undefined }, storage);

  const stored = JSON.parse(storage.raw.get(MODEL_CHOICES_STORAGE_KEY) ?? '{}');
  assert.deepEqual(stored, { completionModelId: 'gpt-5.4' });
});

test('saveModelChoices removes the key when both choices are cleared', () => {
  const storage = createStorage({
    [MODEL_CHOICES_STORAGE_KEY]: JSON.stringify({ completionModelId: 'gpt-5.4' }),
  });
  saveModelChoices({ completionModelId: undefined, generationModelId: undefined }, storage);

  assert.equal(storage.raw.has(MODEL_CHOICES_STORAGE_KEY), false);
});

test('loadModelChoices drops ids that are no longer in the catalog', () => {
  const storage = createStorage({
    [MODEL_CHOICES_STORAGE_KEY]: JSON.stringify({
      completionModelId: 'gpt-5.4',
      generationModelId: 'retired-model-id',
    }),
  });

  assert.deepEqual(loadModelChoices(storage), {
    completionModelId: 'gpt-5.4',
    generationModelId: undefined,
  });
});

test('loadModelChoices tolerates corrupt JSON', () => {
  const storage = createStorage({ [MODEL_CHOICES_STORAGE_KEY]: '{not json' });
  assert.deepEqual(loadModelChoices(storage), {
    completionModelId: undefined,
    generationModelId: undefined,
  });
});

test('loadModelChoices tolerates a non-object payload', () => {
  const storage = createStorage({ [MODEL_CHOICES_STORAGE_KEY]: '"a string"' });
  assert.deepEqual(loadModelChoices(storage), {
    completionModelId: undefined,
    generationModelId: undefined,
  });
});
