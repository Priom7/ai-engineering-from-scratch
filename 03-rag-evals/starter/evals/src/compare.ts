import type { RunFile } from './types.js';

export type Change = 'improved' | 'regressed' | 'unchanged';

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** Pass rate per question in both runs, and whether it went up, down or stayed the same. */
export function compareRuns(base: RunFile, target: RunFile): { id: string; base: number; target: number; change: Change }[] {
  // TODO: For every question in both runs, compare pass rates (passes / attempts, 4 decimals)
  // and label it improved, regressed or unchanged. Skip questions missing from either run.
  throw new Error('TODO: compareRuns');
}
