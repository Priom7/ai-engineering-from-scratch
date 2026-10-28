import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkGate } from './gate.js';
import type { QuestionResult, RunSummary } from './types.js';

const summary = (overall: number, retrieval: number, questions: QuestionResult[] = []): RunSummary => ({
  retrievalHitRate: retrieval,
  answerPassRate: overall,
  honestyPassRate: overall,
  overallPassRate: overall,
  medianSeconds: 1,
  questions,
});
const row = (id: string, passes: number): QuestionResult => ({ id, kind: 'answerable', hit: true, passes, attempts: 3 });

test('passes an equal run', () => {
  assert.deepEqual(checkGate(summary(0.8, 1), summary(0.8, 1)), { ok: true, reasons: [] });
});

test('allows a drop within the margin', () => {
  assert.equal(checkGate(summary(0.8, 1), summary(0.76, 1)).ok, true);
});

test('fails when the overall pass rate drops by more than the margin', () => {
  const result = checkGate(summary(0.8, 1), summary(0.74, 1));
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('\n'), /overallPassRate/);
});

test('fails when the retrieval hit rate drops by more than the margin', () => {
  const result = checkGate(summary(0.8, 1), summary(0.8, 0.9));
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('\n'), /retrievalHitRate/);
});

test('fails when one kind of question drops even though the overall rate holds', () => {
  const baseline = { ...summary(0.9, 1), answerPassRate: 0.91, honestyPassRate: 0.89 };
  const run = { ...summary(0.89, 1), answerPassRate: 0.96, honestyPassRate: 0.67 };
  const result = checkGate(baseline, run);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('\n'), /honestyPassRate dropped from 89% to 67%/);
});

test('does not flag a question that was already flaky in the baseline', () => {
  assert.equal(checkGate(summary(0.8, 1, [row('downgrade', 1)]), summary(0.8, 1, [row('downgrade', 0)])).ok, true);
});

test('fails when a question that always passed now always fails', () => {
  const result = checkGate(summary(0.8, 1, [row('refund-speed', 3)]), summary(0.8, 1, [row('refund-speed', 0)]));
  assert.equal(result.ok, false);
  assert.match(result.reasons.join('\n'), /refund-speed/);
});
