import { readJson } from './api';

// Types and helpers for the Evals view. The data comes from the eval runs saved
// by `npm run eval` (evals/results/*.json), served by the backend.

export interface RunListing {
  name: string;
  config: string;
  createdAt: string;
  chatModel: string;
  repeats: number;
  retrievalHitRate: number;
  answerPassRate: number | null;
  honestyPassRate: number | null;
  overallPassRate: number | null;
  medianSeconds: number | null;
}

export interface EvalAttempt {
  questionId: string;
  attempt: number;
  seed: number;
  answer: string;
  durationMs: number;
  sources: string[];
  passed: boolean;
  reason: string;
  error: string | null;
}

export interface QuestionResult {
  id: string;
  kind: 'answerable' | 'unanswerable';
  hit: boolean | null;
  passes: number;
  attempts: number;
}

export interface EvalRun {
  config: string;
  createdAt: string;
  settings: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    chatModel: string;
    repeats: number;
    judgeModel: string;
    documents?: string[];
  };
  environment: { ollamaVersion: string };
  attempts: EvalAttempt[];
  summary: {
    retrievalHitRate: number;
    answerPassRate: number | null;
    honestyPassRate: number | null;
    overallPassRate: number | null;
    medianSeconds: number | null;
    questions: QuestionResult[];
  };
}

export type Grade =
  | { type: 'facts'; mustSay: string[] }
  | { type: 'judge'; reference: string; rubric: string }
  | { type: 'refuse' };

export interface EvalQuestion {
  id: string;
  question: string;
  source: string | null;
  evidence: string[];
  grade: Grade;
}

export const fetchRuns = () => readJson<{ runs: RunListing[] }>('/api/evals/runs');
export const fetchRun = (name: string) => readJson<EvalRun>(`/api/evals/runs/${encodeURIComponent(name)}`);
export const fetchQuestions = () => readJson<{ questions: EvalQuestion[] }>('/api/evals/questions');

export const pct = (value: number | null | undefined) => (value === null || value === undefined ? '–' : `${Math.round(value * 100)}%`);

/** A change in percentage points, signed: "+5 pts", "−22 pts", "±0". */
export function points(before: number | null, after: number | null) {
  if (before === null || after === null) return null;
  const delta = Math.round(after * 100) - Math.round(before * 100);
  return { delta, label: delta === 0 ? '±0' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} pts` };
}

export const passRate = (row: QuestionResult | undefined) => (row && row.attempts > 0 ? row.passes / row.attempts : null);

export type Change = 'improved' | 'regressed' | 'unchanged';

export function changeOf(base: QuestionResult | undefined, target: QuestionResult | undefined): Change | null {
  const b = passRate(base);
  const t = passRate(target);
  if (b === null || t === null) return null;
  return t > b ? 'improved' : t < b ? 'regressed' : 'unchanged';
}

/** "49/54": passed attempts out of attempts, for one kind of question or all. */
export function tally(run: EvalRun, kind: 'answerable' | 'unanswerable' | 'all') {
  const rows = run.summary.questions.filter((q) => kind === 'all' || q.kind === kind);
  return `${rows.reduce((n, q) => n + q.passes, 0)}/${rows.reduce((n, q) => n + q.attempts, 0)}`;
}

export function runLabel(run: Pick<RunListing, 'name' | 'chatModel'>) {
  return `${run.name} · ${run.chatModel}`;
}
