import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { containsPhrase, gradeFacts, JUDGE_FORMAT, parseJudge, retrievalHit } from './graders.js';

describe('containsPhrase', () => {
  test('finds a phrase as whole words', () => {
    assert.equal(containsPhrase('Refunds take 5 to 10 business days.', '5 to 10 business days'), true);
  });

  test('ignores a phrase inside a longer word', () => {
    assert.equal(containsPhrase('Parisian cafes are lovely.', 'Paris'), false);
  });

  test('accepts any alternative separated by |', () => {
    assert.equal(containsPhrase('You have thirty days.', '30 days|thirty days'), true);
  });

  test('ignores case and punctuation', () => {
    assert.equal(containsPhrase('Team costs £12/user.', '12'), true);
  });

  test('only checks that the fact is there, so yes/no questions go to the judge', () => {
    assert.equal(containsPhrase('If a ticket has no response within 30 minutes, an engineer is paged.', '30 minutes'), true);
  });
});

describe('gradeFacts', () => {
  test('passes when every phrase is there', () => {
    assert.equal(gradeFacts('Team costs £12 per user per month.', ['12', 'per user']).passed, true);
  });

  test('fails and names the missing phrase', () => {
    const result = gradeFacts('Team costs £12.', ['12', 'per user']);
    assert.equal(result.passed, false);
    assert.match(result.reason, /per user/);
  });
});

describe('retrievalHit', () => {
  test('ignores case and line breaks', () => {
    assert.equal(retrievalHit(['Annual plans can be\nrefunded IN FULL within 30 days'], ['refunded in full within 30 days']), true);
  });

  test('misses when the evidence is split across two chunks', () => {
    assert.equal(retrievalHit(['Annual plans can be refunded', 'in full within 30 days'], ['refunded in full within 30 days']), false);
  });

  test('hits when any evidence phrase is in any chunk', () => {
    assert.equal(retrievalHit(['nothing here', 'the region cannot be changed later'], ['no match', 'cannot be changed later']), true);
  });
});

describe('parseJudge', () => {
  test('reads a valid verdict', () => {
    assert.deepEqual(parseJudge('{"reason":"ok","verdict":"pass"}'), { passed: true, reason: 'ok' });
    assert.deepEqual(parseJudge('{"reason":"wrong plan","verdict":"fail"}'), { passed: false, reason: 'wrong plan' });
  });

  test('counts text that is not JSON as a fail', () => {
    assert.equal(parseJudge('nope').passed, false);
  });

  test('asks for the reason before the verdict', () => {
    assert.deepEqual(Object.keys(JUDGE_FORMAT.properties), ['reason', 'verdict']);
  });

  test('counts any verdict other than "pass" as a fail', () => {
    assert.equal(parseJudge('{"reason":"hmm","verdict":"maybe"}').passed, false);
    assert.equal(parseJudge('{"pass":true}').passed, false);
  });
});
