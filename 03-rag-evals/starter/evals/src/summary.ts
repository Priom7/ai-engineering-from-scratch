import type { Attempt, Question, QuestionResult, RunSummary } from './types.js';

const round = (value: number) => Math.round(value * 10_000) / 10_000;
const rate = (items: Attempt[]) => (items.length === 0 ? null : round(items.filter((a) => a.passed).length / items.length));

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarize(questions: Question[], attempts: Attempt[], hits: Record<string, boolean>): RunSummary {
  // TODO: Build the RunSummary (see types.ts):
  // - retrievalHitRate: answerable questions whose evidence was found, out of answerable questions in `hits`
  // - answerPassRate / honestyPassRate / overallPassRate: passed attempts out of attempts (null when there are none)
  // - medianSeconds: median durationMs of attempts without an error, in seconds
  // - questions: one row per question, in dataset order. Round rates to 4 decimals.
  throw new Error('TODO: summarize');
}
