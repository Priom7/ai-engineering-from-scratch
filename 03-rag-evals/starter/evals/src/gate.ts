import type { RunSummary } from './types.js';

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * The check before shipping: a run must not score worse than the baseline.
 * Small drops within `margin` are allowed, because answers vary run to run.
 */
export function checkGate(baseline: RunSummary, run: RunSummary, margin = 0.05): { ok: boolean; reasons: string[] } {
  // TODO: Add a reason when overallPassRate, answerPassRate, honestyPassRate or retrievalHitRate
  // drops by more than `margin` (check each one: an average can hide a drop in one kind of question),
  // and one for each question that passed every attempt in the baseline but fails every attempt now.
  // ok is true when there are no reasons.
  throw new Error('TODO: checkGate');
}
