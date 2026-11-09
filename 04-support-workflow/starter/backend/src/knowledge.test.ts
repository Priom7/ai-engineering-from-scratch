import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { resolveDocsDir } from './knowledge.js';

test('the documents default to sample-docs, and DOCS_DIR is relative to the backend folder', () => {
  const root = path.resolve('/app');
  assert.equal(resolveDocsDir(root), path.join(root, 'sample-docs'));
  assert.equal(resolveDocsDir(root, '../my-docs'), path.join(root, 'my-docs'));
  assert.equal(resolveDocsDir(root, path.resolve('/data/docs')), path.resolve('/data/docs'));
});
