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
  const answerableIds = new Set(questions.filter((q) => q.source !== null).map((q) => q.id));
  const answerable = attempts.filter((a) => answerableIds.has(a.questionId));
  const unanswerable = attempts.filter((a) => !answerableIds.has(a.questionId));
  const scored = [...answerableIds].filter((id) => id in hits);
  const seconds = median(attempts.filter((a) => a.error === null).map((a) => a.durationMs));

  const rows: QuestionResult[] = questions.map((q) => {
    const mine = attempts.filter((a) => a.questionId === q.id);
    return {
      id: q.id,
      kind: answerableIds.has(q.id) ? 'answerable' : 'unanswerable',
      hit: answerableIds.has(q.id) ? (hits[q.id] ?? null) : null,
      passes: mine.filter((a) => a.passed).length,
      attempts: mine.length,
    };
  });

  return {
    retrievalHitRate: scored.length === 0 ? 0 : round(scored.filter((id) => hits[id]).length / scored.length),
    answerPassRate: rate(answerable),
    honestyPassRate: rate(unanswerable),
    overallPassRate: rate(attempts),
    medianSeconds: seconds === null ? null : round(seconds / 1000),
    questions: rows,
  };
}
