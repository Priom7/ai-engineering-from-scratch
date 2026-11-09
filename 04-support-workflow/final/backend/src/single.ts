import { newRunId, type StepDeps } from './workflow/engine.js';
import { DEFAULT_SYSTEM_PROMPT, generate } from './rag.js';
import type { RunRecord, StepTrace } from './workflow/types.js';

// The baseline: Episode 2's app. One retrieval, one model call, and the reply
// always goes out. The workflow is measured against this.

export async function runSinglePrompt(email: string, deps: StepDeps, model: string): Promise<RunRecord> {
  const clock = deps.clock ?? Date.now;
  const start = clock();
  const steps: StepTrace[] = [];
  const step = (nodeId: string, title: string, type: StepTrace['type'], started: number, output: unknown, extra: Partial<StepTrace> = {}): StepTrace => ({
    nodeId,
    title,
    type,
    startMs: started - start,
    durationMs: clock() - started,
    modelMs: 0,
    loadMs: 0,
    attempts: [],
    status: 'ok',
    output,
    error: null,
    next: null,
    ...extra,
  });

  const findStart = clock();
  const matches = await deps.retrieve(email, 4);
  steps.push(step('find', 'Find', 'retrieve', findStart, { matches: matches.map((m) => ({ documentName: m.documentName, score: m.score })) }, { next: 'answer' }));

  const answerStart = clock();
  const result = await generate(email, matches, { chatModel: model, systemPrompt: DEFAULT_SYSTEM_PROMPT }, deps.chat);
  const load = result.loadDurationMs ?? 0;
  steps.push(
    step('answer', 'Answer', 'llm-text', answerStart, result.content, {
      modelMs: Math.max(0, result.durationMs - load),
      loadMs: load,
      attempts: [{ attempt: 1, raw: result.content, error: null }],
    }),
  );

  return {
    id: newRunId(),
    workflowId: 'single-prompt',
    mode: 'single',
    emailId: null,
    email,
    startedAt: new Date(start).toISOString(),
    durationMs: clock() - start,
    outcome: 'ready',
    reply: result.content,
    context: { email },
    steps,
  };
}
