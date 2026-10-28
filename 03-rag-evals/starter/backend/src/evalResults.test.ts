import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { listRuns, readRun } from './evalResults.js';

const dirs: string[] = [];
after(async () => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const run = (config: string, createdAt: string) => ({
  config,
  createdAt,
  settings: { chatModel: 'llama3.2:3b', repeats: 3 },
  summary: { overallPassRate: 0.9, retrievalHitRate: 1, answerPassRate: 0.91, honestyPassRate: 0.89, medianSeconds: 2, questions: [] },
  attempts: [{ answer: 'long text' }],
});

async function resultsDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'eval-results-'));
  dirs.push(dir);
  await writeFile(path.join(dir, 'baseline.json'), JSON.stringify(run('baseline', '2026-10-26T21:12:00Z')));
  await writeFile(path.join(dir, 'prompt-b.json'), JSON.stringify(run('prompt-b', '2026-10-26T21:20:00Z')));
  await writeFile(path.join(dir, 'notes.txt'), 'not a run');
  return dir;
}

test('listRuns returns one summary per result file, newest first, without the attempts', async () => {
  const runs = await listRuns(await resultsDir());
  assert.deepEqual(
    runs.map((r) => r.name),
    ['prompt-b', 'baseline'],
  );
  assert.equal(runs[0].chatModel, 'llama3.2:3b');
  assert.equal('attempts' in runs[0], false);
});

test('listRuns returns an empty list when the folder does not exist', async () => {
  assert.deepEqual(await listRuns('/nonexistent/results'), []);
});

test('readRun returns the full run, attempts included', async () => {
  const result = await readRun(await resultsDir(), 'baseline');
  assert.equal(result?.attempts.length, 1);
});

test('readRun refuses names that could leave the results folder', async () => {
  const dir = await resultsDir();
  assert.equal(await readRun(dir, '../package'), null);
  assert.equal(await readRun(dir, 'baseline.json'), null);
});

test('readRun returns null for a run that does not exist', async () => {
  assert.equal(await readRun(await resultsDir(), 'missing'), null);
});
