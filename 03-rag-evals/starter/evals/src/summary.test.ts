import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarize } from './summary.js';
import type { Attempt, Question } from './types.js';

const questions: Question[] = [
  { id: 'a', question: 'A?', source: 'one.md', evidence: ['x'], grade: { type: 'facts', mustSay: ['x'] } },
  { id: 'b', question: 'B?', source: 'two.md', evidence: ['y'], grade: { type: 'facts', mustSay: ['y'] } },
  { id: 'c', question: 'C?', source: null, evidence: [], grade: { type: 'refuse' } },
];

const attempt = (questionId: string, attempt: number, passed: boolean, durationMs: number, error: string | null = null): Attempt => ({
  questionId,
  attempt,
  seed: attempt,
  answer: '',
  durationMs,
  sources: [],
  passed,
  reason: '',
  error,
});

const attempts = [
  attempt('a', 1, true, 1000),
  attempt('a', 2, true, 2000),
  attempt('b', 1, false, 3000),
  attempt('b', 2, true, 4000),
  attempt('c', 1, false, 5000),
  attempt('c', 2, false, 0, 'timeout'),
];

test('computes rates per kind of question', () => {
  const summary = summarize(questions, attempts, { a: true, b: false });
  assert.equal(summary.retrievalHitRate, 0.5);
  assert.equal(summary.answerPassRate, 0.75);
  assert.equal(summary.honestyPassRate, 0);
  assert.equal(summary.overallPassRate, 0.5);
});

test('takes the median duration over attempts without errors', () => {
  assert.equal(summarize(questions, attempts, { a: true, b: false }).medianSeconds, 3);
});

test('lists each question with its passes and hit', () => {
  const { questions: rows } = summarize(questions, attempts, { a: true, b: false });
  assert.deepEqual(rows, [
    { id: 'a', kind: 'answerable', hit: true, passes: 2, attempts: 2 },
    { id: 'b', kind: 'answerable', hit: false, passes: 1, attempts: 2 },
    { id: 'c', kind: 'unanswerable', hit: null, passes: 0, attempts: 2 },
  ]);
});

test('leaves answer rates empty for a retrieval-only run', () => {
  const summary = summarize(questions, [], { a: true, b: true });
  assert.equal(summary.retrievalHitRate, 1);
  assert.equal(summary.overallPassRate, null);
  assert.equal(summary.medianSeconds, null);
});
