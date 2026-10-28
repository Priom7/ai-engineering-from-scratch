import type { RunSummary } from './types.js';

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * The check before shipping: a run must not score worse than the baseline.
 * Small drops within `margin` are allowed, because answers vary run to run.
 */
export function checkGate(baseline: RunSummary, run: RunSummary, margin = 0.05): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Each metric on its own: an average can hide a drop in one kind of question.
  for (const metric of ['overallPassRate', 'answerPassRate', 'honestyPassRate', 'retrievalHitRate'] as const) {
    const before = baseline[metric];
    const now = run[metric];
    if (before !== null && now !== null && now < before - margin - 1e-9) {
      reasons.push(`${metric} dropped from ${percent(before)} to ${percent(now)}`);
    }
  }

  const now = new Map(run.questions.map((q) => [q.id, q]));
  for (const before of baseline.questions) {
    const after = now.get(before.id);
    if (before.attempts > 0 && before.passes === before.attempts && after && after.attempts > 0 && after.passes === 0) {
      reasons.push(`${before.id} passed every attempt in the baseline and fails every attempt now`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
