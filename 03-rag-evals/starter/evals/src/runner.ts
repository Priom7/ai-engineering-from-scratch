import type { ChatRequest, ChatResult } from '../../backend/src/ollama.js';
import { buildContext, generate, retrieve, type RagSettings } from '../../backend/src/rag.js';
import type { SearchMatch, StoredChunk } from '../../backend/src/types.js';
import { gradeFacts, JUDGE_FORMAT, judgeMessages, parseJudge, retrievalHit } from './graders.js';
import type { Attempt, Question } from './types.js';

export type RunDeps = {
  embed: (text: string) => Promise<number[]>;
  send: (request: ChatRequest) => Promise<ChatResult>;
  unload: (model: string) => Promise<void>;
  judgeModel: string;
  onProgress?: (message: string) => void;
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * One eval run. Order matters on an 8 GB machine:
 * retrieve everything, generate every answer, unload the answering model, then grade.
 */
export async function runEval(
  questions: Question[],
  chunks: StoredChunk[],
  settings: RagSettings,
  repeats: number,
  deps: RunDeps,
  options: { retrievalOnly?: boolean } = {},
): Promise<{ attempts: Attempt[]; hits: Record<string, boolean> }> {
  // TODO 1: Retrieve once per question (retrieve() from rag.ts) and record a hit for answerable questions.
  // TODO 2: With options.retrievalOnly, return now with no attempts.
  // TODO 3: Send one warm-up call, then generate `repeats` attempts per question with seed = attempt number.
  //         A thrown error, or an empty answer, becomes a failed attempt with `error` set.
  // TODO 4: Unload the chat model if the judge is a different model, then grade: "facts" with gradeFacts(),
  //         "judge" and "refuse" with the judge (temperature 0, seed 0, JUDGE_FORMAT). Unload the judge at the end.
  throw new Error('TODO: runEval');
}
