import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAndValidate, retryPrompt } from './schema.js';

const schema = {
  type: 'object',
  properties: { intent: { type: 'string', enum: ['refund', 'other'] }, question: { type: 'string' } },
  required: ['intent', 'question'],
  additionalProperties: false,
};

test('accepts valid JSON', () => {
  assert.deepEqual(parseAndValidate('{"intent":"refund","question":"Can I get my money back?"}', schema), {
    ok: true,
    value: { intent: 'refund', question: 'Can I get my money back?' },
  });
});

test('extracts the JSON object from prose around it', () => {
  const result = parseAndValidate('Sure! Here it is:\n{"intent":"other","question":"Hi"}\nHope that helps.', schema);
  assert.equal(result.ok, true);
});

test('rejects text that is not JSON', () => {
  const result = parseAndValidate('I think this is about a refund.', schema);
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /not JSON/);
});

test('names the missing required field', () => {
  const result = parseAndValidate('{"question":"Hi"}', schema);
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /intent/);
});

test('rejects a value outside the enum', () => {
  assert.equal(parseAndValidate('{"intent":"complaint","question":"Hi"}', schema).ok, false);
});

test('the retry prompt quotes the error and asks for JSON only', () => {
  const prompt = retryPrompt('not JSON', "must have required property 'intent'");
  assert.match(prompt, /must have required property 'intent'/);
  assert.match(prompt, /only JSON/);
});
