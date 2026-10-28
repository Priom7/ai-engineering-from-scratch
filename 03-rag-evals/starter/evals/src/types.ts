import type { RagSettings } from '../../backend/src/rag.js';

/** How an answer is graded. */
export type Grade =
  /** Every phrase must appear, not negated. Separate alternatives with "|". */
  | { type: 'facts'; mustSay: string[] }
  /** An LLM judge compares the answer with a reference, using a rubric. */
  | { type: 'judge'; reference: string; rubric: string }
  /** The documents don't answer this, so the app should say so. */
  | { type: 'refuse' };

export type Question = {
  id: string;
  question: string;
  /** The document that answers it, or null when no document does. */
  source: string | null;
  /** Short phrases from the source; retrieval hits when a retrieved chunk contains one. */
  evidence: string[];
  grade: Grade;
};

export type Attempt = {
  questionId: string;
  attempt: number;
  seed: number;
  answer: string;
  durationMs: number;
  /** Document names of the retrieved chunks, in rank order. */
  sources: string[];
  passed: boolean;
  reason: string;
  error: string | null;
};

export type QuestionResult = {
  id: string;
  kind: 'answerable' | 'unanswerable';
  /** Whether retrieval found the evidence; null for unanswerable questions. */
  hit: boolean | null;
  passes: number;
  attempts: number;
};

export type RunSummary = {
  retrievalHitRate: number;
  /** Null when the run only measured retrieval. */
  answerPassRate: number | null;
  honestyPassRate: number | null;
  overallPassRate: number | null;
  medianSeconds: number | null;
  questions: QuestionResult[];
};

/** `documents` limits the knowledge base to some sample documents (default: all of them). */
export type RunSettings = RagSettings & { repeats: number; judgeModel: string; documents?: string[] };

export type RunFile = {
  config: string;
  createdAt: string;
  settings: RunSettings;
  environment: { ollamaVersion: string; models: Record<string, string | null> };
  attempts: Attempt[];
  hits: Record<string, boolean>;
  summary: RunSummary;
};
