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
  const progress = deps.onProgress ?? (() => undefined);

  // 1. Retrieval: the same for every attempt, so it runs once per question.
  const retrieved = new Map<string, SearchMatch[]>();
  const hits: Record<string, boolean> = {};
  for (const q of questions) {
    const matches = await retrieve(q.question, chunks, settings.topK, deps.embed);
    retrieved.set(q.id, matches);
    if (q.source !== null) hits[q.id] = retrievalHit(matches.map((m) => m.text), q.evidence);
  }
  progress(`retrieved ${questions.length} questions`);
  if (options.retrievalOnly) return { attempts: [], hits };

  // 2. Generation. A warm-up call loads the model, so load time isn't counted as answer time.
  await deps.send({ model: settings.chatModel, system: 'Reply with OK.', user: 'OK' }).catch(() => undefined);
  const attempts: Attempt[] = [];
  for (const q of questions) {
    const matches = retrieved.get(q.id) ?? [];
    for (let attempt = 1; attempt <= repeats; attempt += 1) {
      const base = { questionId: q.id, attempt, seed: attempt, sources: matches.map((m) => m.documentName) };
      try {
        const result = await generate(q.question, matches, settings, deps.send, attempt);
        const error = result.content ? null : 'The model returned an empty answer.';
        attempts.push({ ...base, answer: result.content, durationMs: result.durationMs, passed: false, reason: '', error });
      } catch (error) {
        attempts.push({ ...base, answer: '', durationMs: 0, passed: false, reason: '', error: message(error) });
      }
      progress(`answered ${attempts.length}/${questions.length * repeats}`);
    }
  }

  // 3. Grading. Free the answering model first if the judge is a different one.
  const byId = new Map(questions.map((q) => [q.id, q]));
  const needsJudge = attempts.some((a) => a.error === null && byId.get(a.questionId)?.grade.type !== 'facts');
  if (needsJudge && settings.chatModel !== deps.judgeModel) await deps.unload(settings.chatModel);

  for (const a of attempts) {
    if (a.error !== null) {
      a.reason = a.error;
      continue;
    }
    const q = byId.get(a.questionId)!;
    if (q.grade.type === 'facts') {
      Object.assign(a, gradeFacts(a.answer, q.grade.mustSay));
      continue;
    }
    try {
      const { system, user } = judgeMessages(q, a.answer, buildContext(retrieved.get(q.id) ?? []));
      const reply = await deps.send({ model: deps.judgeModel, system, user, temperature: 0, seed: 0, format: JUDGE_FORMAT });
      Object.assign(a, parseJudge(reply.content));
    } catch (error) {
      a.passed = false;
      a.error = `Grading failed: ${message(error)}`;
      a.reason = a.error;
    }
  }
  if (needsJudge) await deps.unload(deps.judgeModel);
  progress('graded');

  return { attempts, hits };
}
