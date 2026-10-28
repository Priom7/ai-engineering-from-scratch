import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareRuns } from './compare.js';
import type { QuestionResult, RunFile } from './types.js';

const run = (questions: QuestionResult[]) => ({ summary: { questions } }) as unknown as RunFile;
const row = (id: string, passes: number): QuestionResult => ({ id, kind: 'answerable', hit: true, passes, attempts: 3 });

test('labels each question improved, regressed or unchanged', () => {
  const rows = compareRuns(run([row('a', 1), row('b', 3), row('c', 2)]), run([row('a', 3), row('b', 0), row('c', 2)]));
  assert.deepEqual(rows, [
    { id: 'a', base: 0.3333, target: 1, change: 'improved' },
    { id: 'b', base: 1, target: 0, change: 'regressed' },
    { id: 'c', base: 0.6667, target: 0.6667, change: 'unchanged' },
  ]);
});

test('skips questions that are only in one run', () => {
  assert.deepEqual(
    compareRuns(run([row('a', 3)]), run([row('b', 3)])),
    [],
  );
});
