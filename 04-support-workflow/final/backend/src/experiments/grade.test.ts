import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Email } from '../store.js';
import type { RunRecord, StepTrace } from '../workflow/types.js';
import { containsPhrase, gradeOutcome, parseVerdict, regradeResult, summarizeExperiment, type EmailResult } from './grade.js';

const email = (id: string, route: 'ready' | 'review' | 'escalated', intent = 'refund'): Email => ({ id, from: 'A', subject: 'S', body: 'B', expected: { intent, route } });
const step = (nodeId: string, durationMs: number, extra: Partial<StepTrace> = {}): StepTrace => ({
  nodeId,
  title: nodeId,
  type: 'llm-text',
  startMs: 0,
  durationMs,
  modelMs: durationMs,
  loadMs: 0,
  attempts: [],
  status: 'ok',
  output: null,
  error: null,
  next: null,
  ...extra,
});
const run = (outcome: RunRecord['outcome'], steps: StepTrace[] = [], context: Record<string, unknown> = {}): RunRecord => ({
  id: 'r',
  workflowId: 'w',
  mode: 'workflow',
  emailId: 'e',
  email: 'x',
  startedAt: '',
  durationMs: steps.reduce((n, s) => n + s.durationMs, 0),
  outcome,
  reply: 'reply',
  context,
  steps,
});

test('a wrong reply that goes out counts as sent wrong', () => {
  assert.equal(gradeOutcome(email('a', 'ready'), run('ready'), false).sentWrong, true);
});

test('a wrong reply stopped for review counts as caught, not sent wrong', () => {
  const result = gradeOutcome(email('a', 'ready'), run('review'), false);
  assert.equal(result.sentWrong, false);
  assert.equal(result.caught, true);
});

test('regrading a saved result recomputes sent wrong and caught from the new verdict', () => {
  const sent = gradeOutcome(email('a', 'review'), run('ready'), false);
  const regraded = regradeResult(sent, true);
  assert.equal(regraded.replyCorrect, true);
  assert.equal(regraded.sentWrong, false);
  const reviewed = regradeResult(gradeOutcome(email('b', 'ready'), run('review'), true), false);
  assert.equal(reviewed.caught, true);
  assert.equal(reviewed.durationMs, 0);
});

test('the understand step reports intent and JSON attempts', () => {
  const understand = step('understand', 10, { attempts: [{ attempt: 1, raw: 'x', error: 'not JSON' }, { attempt: 2, raw: '{}', error: null }] });
  const result = gradeOutcome(email('a', 'ready', 'refund'), run('ready', [understand], { understand: { intent: 'refund' } }), true);
  assert.equal(result.intentCorrect, true);
  assert.equal(result.jsonFirstTry, false);
  assert.equal(result.jsonAttempts, 2);
});

test('summarizes counts, rates and medians', () => {
  const results: EmailResult[] = [
    gradeOutcome(email('a', 'ready'), run('ready', [step('draft', 1000)]), true),
    gradeOutcome(email('b', 'ready'), run('ready', [step('draft', 3000)]), false),
    gradeOutcome(email('c', 'ready'), run('review', [step('draft', 2000)]), false),
    gradeOutcome(email('d', 'escalated', 'outage'), run('escalated', [step('draft', 0)]), null),
  ];
  const s = summarizeExperiment(results);
  assert.equal(s.emails, 4);
  assert.equal(s.sentWrong, 1);
  assert.equal(s.sentRight, 1);
  assert.equal(s.caught, 1);
  assert.equal(s.review, 1);
  assert.equal(s.escalated, 1);
  assert.equal(s.escalationCorrect, 4);
  assert.equal(s.medianSeconds, 1.5);
  assert.equal(s.stepMedians.draft, 1.5);
});

test('reads a grading verdict, and anything else is a fail', () => {
  assert.equal(parseVerdict('{"reason":"ok","verdict":"pass"}').passed, true);
  assert.equal(parseVerdict('{"reason":"no","verdict":"fail"}').passed, false);
  assert.equal(parseVerdict('nonsense').passed, false);
});

test('containsPhrase matches whole words and | alternatives', () => {
  assert.equal(containsPhrase('Refunds take 5-10 business days.', '5 to 10 business days|5-10 business days'), true);
  assert.equal(containsPhrase('That costs £120.', '12'), false);
});
