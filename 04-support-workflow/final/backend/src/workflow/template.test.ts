import assert from 'node:assert/strict';
import { test } from 'node:test';

import { render } from './template.js';

test('fills dotted keys from the context', () => {
  assert.equal(render('Hi {{email.name}}', { email: { name: 'Ann' } }), 'Hi Ann');
});

test('renders a missing key as an empty string', () => {
  assert.equal(render('[{{nothing.here}}]', {}), '[]');
});

test('renders objects and arrays as JSON', () => {
  assert.equal(render('{{understand}}', { understand: { intent: 'refund' } }), '{"intent":"refund"}');
});
