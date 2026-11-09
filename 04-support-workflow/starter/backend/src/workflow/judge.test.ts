import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHECK_FORMAT, checkMessages, parseCheck } from './judge.js';

test('reads a supported verdict', () => {
  assert.deepEqual(parseCheck('{"reason":"All claims are in source 1.","verdict":"supported","unsupportedClaims":[]}'), {
    supported: true,
    reason: 'All claims are in source 1.',
    unsupportedClaims: [],
  });
});

test('reads an unsupported verdict with its claims', () => {
  const result = parseCheck('{"reason":"Invented.","verdict":"unsupported","unsupportedClaims":["Students get 30% off"]}');
  assert.equal(result.supported, false);
  assert.deepEqual(result.unsupportedClaims, ['Students get 30% off']);
});

test('treats a reply that is not JSON as unsupported, never supported', () => {
  assert.equal(parseCheck('Looks fine to me!').supported, false);
});

test('treats an unknown verdict as unsupported', () => {
  assert.equal(parseCheck('{"reason":"ok","verdict":"probably","unsupportedClaims":[]}').supported, false);
});

test('asks for the reason before the verdict', () => {
  assert.deepEqual(Object.keys((CHECK_FORMAT as { properties: object }).properties), ['reason', 'verdict', 'unsupportedClaims']);
});

test('gives the judge the sources and the reply', () => {
  const { user } = checkMessages('Refunds take 5 to 10 business days.', '[Source 1: refunds.md]\nRefunds go back within 5 to 10 business days.');
  assert.match(user, /Sources:\n\[Source 1: refunds.md\]/);
  assert.match(user, /Reply to check:\nRefunds take 5 to 10 business days\./);
});
