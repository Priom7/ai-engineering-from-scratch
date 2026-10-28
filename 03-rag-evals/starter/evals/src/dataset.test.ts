import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectQuestions, validateDataset } from './dataset.js';
import type { Question } from './types.js';

const answerable = {
  id: 'refund-speed',
  question: 'How long do refunds take?',
  source: 'fernhill-refund-policy.md',
  evidence: ['within 5 to 10 business days'],
  grade: { type: 'facts', mustSay: ['5 to 10 business days'] },
};
const unanswerable = {
  id: 'student-discount',
  question: 'Do you offer a student discount?',
  source: null,
  evidence: [],
  grade: { type: 'refuse' },
};

const errorOf = (questions: unknown[]) => {
  const result = validateDataset({ questions });
  return 'error' in result ? result.error : '';
};

test('accepts a valid dataset', () => {
  const result = validateDataset({ questions: [answerable, unanswerable] });
  assert.ok('questions' in result);
  assert.equal(result.questions.length, 2);
});

test('rejects a duplicate id', () => {
  assert.match(errorOf([answerable, answerable]), /refund-speed/);
});

test('rejects an unknown grade type', () => {
  assert.match(errorOf([{ ...answerable, grade: { type: 'vibes' } }]), /refund-speed/);
});

test('rejects an answerable question without evidence', () => {
  assert.match(errorOf([{ ...answerable, evidence: [] }]), /refund-speed/);
});

test('rejects an unanswerable question that is not graded as refuse', () => {
  assert.match(errorOf([{ ...unanswerable, grade: answerable.grade }]), /student-discount/);
});

test('selectQuestions keeps only the requested ids, in dataset order', () => {
  const result = selectQuestions([answerable, unanswerable] as Question[], ['student-discount']);
  assert.deepEqual(result.map((q) => q.id), ['student-discount']);
});

test('selectQuestions keeps everything when no ids are given', () => {
  assert.equal(selectQuestions([answerable, unanswerable] as Question[], undefined).length, 2);
});

test('selectQuestions rejects an unknown id by name', () => {
  assert.throws(() => selectQuestions([answerable] as Question[], ['no-such-question']), /no-such-question/);
});
