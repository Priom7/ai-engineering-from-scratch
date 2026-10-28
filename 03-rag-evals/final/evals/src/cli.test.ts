import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const evalsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = (...args: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], { cwd: evalsDir, encoding: 'utf8' });

test('check exits 2 with a hint when the baseline file is missing', () => {
  const result = cli('check', 'baseline', '--baseline', '/nonexistent/baseline.json');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /No baseline at .*cp evals\/results\/baseline.json evals\/baseline.json/);
});

test('an unknown command exits 1 and lists the commands', () => {
  const result = cli('dance');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /run, compare, check or judge-check/);
});
