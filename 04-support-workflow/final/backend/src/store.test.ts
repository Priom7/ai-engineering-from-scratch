import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createStore } from './store.js';

async function store() {
  const dir = await mkdtemp(path.join(tmpdir(), 'support-store-'));
  await mkdir(path.join(dir, 'runs'), { recursive: true });
  await writeFile(
    path.join(dir, 'emails.json'),
    JSON.stringify({ emails: [{ id: 'sample', from: 'Ann', subject: 'Hi', body: 'Hello', expected: { intent: 'other', route: 'review' } }] }),
  );
  return createStore(dir);
}

test('addEmail rejects an empty body', async () => {
  await assert.rejects((await store()).addEmail({ from: 'A', subject: 'S', body: '   ' }), /empty/);
});

test('addEmail rejects a body over 8000 characters', async () => {
  await assert.rejects((await store()).addEmail({ from: 'A', subject: 'S', body: 'x'.repeat(9000) }), /8000/);
});

test('pasted emails come first, before the samples', async () => {
  const s = await store();
  const added = await s.addEmail({ from: 'Bea', subject: 'Refund', body: 'Can I get a refund?' });
  const emails = await s.listEmails();
  assert.deepEqual(
    emails.map((e) => e.id),
    [added.id, 'sample'],
  );
});

test('readRun refuses ids that could leave the runs folder', async () => {
  assert.equal(await (await store()).readRun('../emails'), null);
});

test('saveRun then readRun returns the run, and listRuns lists it', async () => {
  const s = await store();
  const run = { id: 'run-1-abc', workflowId: 'w', mode: 'workflow' as const, emailId: null, email: 'x', startedAt: '2026-10-28T10:00:00Z', durationMs: 1, outcome: 'ready' as const, reply: 'y', context: {}, steps: [] };
  await s.saveRun(run);
  assert.equal((await s.readRun('run-1-abc'))?.reply, 'y');
  assert.equal((await s.listRuns())[0].id, 'run-1-abc');
});
