import assert from 'node:assert/strict';
import test from 'node:test';

import { errorResponse, notFound, unauthorized } from './responses.ts';

test('errorResponse sets the status and the { error } body shape', async () => {
  const res = errorResponse('boom', 500);
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'boom' });
});

test('unauthorized is a 401 with a stable message', async () => {
  const res = unauthorized();
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Unauthorized' });
});

test('notFound defaults to 404 / Not found and accepts a custom message', async () => {
  const res = notFound();
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });

  const custom = notFound('Project not found');
  assert.equal(custom.status, 404);
  assert.deepEqual(await custom.json(), { error: 'Project not found' });
});
