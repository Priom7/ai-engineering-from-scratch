import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { loadWorkflow } from './load.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('loads the support desk workflow', () => {
  const workflow = loadWorkflow(path.join(root, 'workflows', 'support-desk.json'));
  assert.equal(workflow.start, 'understand');
  assert.ok(workflow.nodes.some((n) => n.type === 'judge'));
});

test('rejects an edge that points at a node that does not exist', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'workflow-'));
  const file = path.join(dir, 'bad.json');
  await writeFile(
    file,
    JSON.stringify({
      id: 'bad',
      name: 'Bad',
      start: 'a',
      nodes: [{ id: 'a', title: 'A', type: 'end', outcome: 'ready', position: { x: 0, y: 0 } }],
      edges: [{ id: 'e', from: 'a', to: 'ghost', kind: 'next' }],
    }),
  );
  assert.throws(() => loadWorkflow(file), /ghost/);
});

test('rejects a start node that does not exist', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'workflow-'));
  const file = path.join(dir, 'bad.json');
  await writeFile(file, JSON.stringify({ id: 'bad', name: 'Bad', start: 'nowhere', nodes: [], edges: [] }));
  assert.throws(() => loadWorkflow(file), /nowhere/);
});
