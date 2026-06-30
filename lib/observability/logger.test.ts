import assert from 'node:assert/strict';
import test from 'node:test';

import { describeError, logger } from './logger.ts';

function capture(
  stream: 'stdout' | 'stderr',
  fn: () => void,
): string[] {
  const lines: string[] = [];
  const target = process[stream];
  const originalWrite = target.write.bind(target);
  // Override the write signature for the duration of the call.
  (target as { write: (chunk: string) => boolean }).write = (chunk: string) => {
    lines.push(String(chunk));
    return true;
  };

  try {
    fn();
  } finally {
    (target as { write: typeof originalWrite }).write = originalWrite;
  }

  return lines;
}

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

test('logger.info emits a structured JSON line to stdout', () => {
  withEnv({ LOG_LEVEL: 'info' }, () => {
    const lines = capture('stdout', () => logger.info('hello', { route: '/x', count: 2 }));

    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.level, 'info');
    assert.equal(entry.msg, 'hello');
    assert.equal(entry.route, '/x');
    assert.equal(entry.count, 2);
    assert.equal(typeof entry.time, 'string');
  });
});

test('logger.error writes to stderr', () => {
  withEnv({ LOG_LEVEL: 'info' }, () => {
    const lines = capture('stderr', () => logger.error('boom', { status: 500 }));

    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.level, 'error');
    assert.equal(entry.status, 500);
  });
});

test('logger suppresses events below the configured threshold', () => {
  withEnv({ LOG_LEVEL: 'warn' }, () => {
    assert.equal(capture('stdout', () => logger.info('skip me')).length, 0);
    assert.equal(capture('stderr', () => logger.warn('keep me')).length, 1);
  });
});

test('logger is silent by default outside production/development runtimes', () => {
  withEnv({ LOG_LEVEL: undefined, NODE_ENV: 'test' }, () => {
    assert.equal(capture('stdout', () => logger.info('should not appear')).length, 0);
    assert.equal(capture('stderr', () => logger.error('should not appear either')).length, 0);
  });
});

test('describeError extracts name and message from any thrown value', () => {
  assert.deepEqual(describeError(new TypeError('bad input')), {
    errorName: 'TypeError',
    errorMessage: 'bad input',
  });
  assert.deepEqual(describeError('plain string'), {
    errorName: 'UnknownError',
    errorMessage: 'plain string',
  });
});
