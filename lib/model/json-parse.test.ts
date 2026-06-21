import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseStructuredModelJson } from './json-parse.ts';

test('parses clean JSON produced by native structured output', () => {
  assert.deepEqual(parseStructuredModelJson('{"dsl":"@root: Topic"}'), { dsl: '@root: Topic' });
});

test('parses JSON wrapped in a ```json code fence', () => {
  const text = 'Here is the result:\n```json\n{"dsl":"@root: Topic"}\n```\nDone.';
  assert.deepEqual(parseStructuredModelJson(text), { dsl: '@root: Topic' });
});

test('parses JSON wrapped in a plain ``` code fence', () => {
  const text = '```\n{"a":1,"b":[1,2,3]}\n```';
  assert.deepEqual(parseStructuredModelJson(text), { a: 1, b: [1, 2, 3] });
});

test('extracts a balanced object embedded in surrounding prose', () => {
  const text = 'Sure! {"dsl":"@root: A","extra":{"n":2}} hope that helps.';
  assert.deepEqual(parseStructuredModelJson(text), { dsl: '@root: A', extra: { n: 2 } });
});

test('ignores braces inside string values when extracting', () => {
  const text = 'Result: {"label":"a } b","ok":true} end';
  assert.deepEqual(parseStructuredModelJson(text), { label: 'a } b', ok: true });
});

test('handles escaped quotes inside string values', () => {
  const text = '{"label":"say \\"hi\\"","ok":true}';
  assert.deepEqual(parseStructuredModelJson(text), { label: 'say "hi"', ok: true });
});

test('parses a top-level JSON array', () => {
  assert.deepEqual(parseStructuredModelJson('prefix [1, 2, 3] suffix'), [1, 2, 3]);
});

test('throws a descriptive error when no JSON is present', () => {
  assert.throws(
    () => parseStructuredModelJson('no json here at all'),
    /did not contain parseable JSON/,
  );
});
