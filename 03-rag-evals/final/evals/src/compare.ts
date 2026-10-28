import type { RunFile } from './types.js';

export type Change = 'improved' | 'regressed' | 'unchanged';

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** Pass rate per question in both runs, and whether it went up, down or stayed the same. */
export function compareRuns(base: RunFile, target: RunFile): { id: string; base: number; target: number; change: Change }[] {
  const after = new Map(target.summary.questions.map((q) => [q.id, q]));
  return base.summary.questions.flatMap((before) => {
    const now = after.get(before.id);
    if (!now || before.attempts === 0 || now.attempts === 0) return [];
    const b = round(before.passes / before.attempts);
    const t = round(now.passes / now.attempts);
    const change: Change = t > b ? 'improved' : t < b ? 'regressed' : 'unchanged';
    return [{ id: before.id, base: b, target: t, change }];
  });
}
