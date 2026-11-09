import { randomBytes } from 'node:crypto';

import type { ChatRequest, ChatResult } from '../ollama.js';
import { buildContext } from '../rag.js';
import type { SearchMatch } from '../types.js';
import { CHECK_FORMAT, checkMessages, parseCheck } from './judge.js';
import { parseAndValidate, retryPrompt } from './schema.js';
import { lookup, render } from './template.js';
import type { AttemptTrace, EdgeKind, RunEvent, RunRecord, StepTrace, Workflow, WorkflowNode } from './types.js';

// The engine walks a workflow one step at a time. Each step reads the shared
// context, writes its output into it, and the edges decide what runs next.
// Model and retrieval access are passed in, so the engine can be tested with fakes.

export type StepDeps = {
  chat: (request: ChatRequest) => Promise<ChatResult>;
  retrieve: (query: string, topK: number) => Promise<SearchMatch[]>;
  clock?: () => number;
};

const MAX_STEPS = 50;
const DEFAULT_TIMEOUT_MS = 120_000;

/** Collects what a step did, even if it fails halfway, so the trace shows every attempt. */
type Meter = { attempts: AttemptTrace[]; modelMs: number; loadMs: number };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function callModel(deps: StepDeps, meter: Meter, request: ChatRequest): Promise<string> {
  const result = await deps.chat(request);
  const load = result.loadDurationMs ?? 0;
  meter.loadMs += load;
  meter.modelMs += Math.max(0, result.durationMs - load);
  return result.content;
}

/** Runs one step. Returns its output, and for a condition, which branch to take. */
async function executeStep(node: WorkflowNode, context: Record<string, unknown>, deps: StepDeps, meter: Meter): Promise<{ output: unknown; branch?: boolean }> {
  switch (node.type) {
    case 'llm-json': {
      // TODO: Ask the model for JSON, check it against node.schema, and retry with the error.
      // - render node.prompt with the context, then call callModel() with node.model, node.system,
      //   the prompt, node.temperature (when set) and format: node.schema (when node.useFormat)
      // - check the reply with parseAndValidate(raw, node.schema), and record every attempt in
      //   meter.attempts as { attempt, raw, error } (error is null when the reply is valid)
      // - valid: return { output: the parsed value }
      // - not valid: ask again with retryPrompt(raw, error) added to the prompt, up to node.maxRetries more times
      // - still not valid: throw an Error that says how many attempts were made
      throw new Error('TODO: the llm-json step');
    }
    case 'llm-text': {
      const raw = await callModel(deps, meter, { model: node.model, system: node.system, user: render(node.prompt, context) });
      meter.attempts.push({ attempt: 1, raw, error: null });
      return { output: raw.trim() };
    }
    case 'retrieve': {
      const matches = await deps.retrieve(render(node.query, context), node.topK);
      return {
        output: {
          matches: matches.map((m) => ({ documentName: m.documentName, score: Number(m.score.toFixed(4)), text: m.text })),
          context: buildContext(matches),
        },
      };
    }
    case 'judge': {
      const answer = lookup(context, node.answerFrom);
      const sources = lookup(context, node.contextFrom);
      if (typeof answer !== 'string' || typeof sources !== 'string') throw new Error(`The check needs ${node.answerFrom} and ${node.contextFrom}.`);
      const { system, user } = checkMessages(answer, sources);
      const raw = await callModel(deps, meter, { model: node.model, system, user, temperature: 0, seed: 0, format: CHECK_FORMAT });
      meter.attempts.push({ attempt: 1, raw, error: null });
      return { output: parseCheck(raw) };
    }
    case 'condition': {
      // TODO: The branch is true when every rule in node.all matches. For each rule, the value
      // lookup(context, rule.key) must equal rule.equals (when set) and be one of rule.in (when set).
      // Return { output: branch, branch }.
      throw new Error('TODO: the condition step');
    }
    case 'end':
      return { output: node.outcome };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export const newRunId = () => `run-${Date.now()}-${randomBytes(3).toString('hex')}`;

export async function runWorkflow(
  workflow: Workflow,
  input: { email: string; emailId?: string | null },
  deps: StepDeps,
  onEvent?: (event: RunEvent) => void,
): Promise<RunRecord> {
  const clock = deps.clock ?? Date.now;
  const runStart = clock();
  const byId = new Map(workflow.nodes.map((n) => [n.id, n]));
  const context: Record<string, unknown> = { email: input.email };
  const steps: StepTrace[] = [];
  let outcome: RunRecord['outcome'] = 'failed';
  let reply: string | null = null;
  let current: string | null = workflow.start;

  while (current !== null) {
    if (steps.length >= MAX_STEPS) break;
    const node = byId.get(current);
    if (!node) break;
    // TODO: Run this step and move to the next one.
    // - emit { type: 'step-start', nodeId } first
    // - run it with withTimeout(executeStep(node, context, deps, meter), node.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    //   with a fresh meter: { attempts: [], modelMs: 0, loadMs: 0 }
    // - on success, save the output in context[node.output] (not for condition or end steps).
    //   An llm-text output is the reply. A condition follows its 'true' or 'false' edge; other steps follow 'next'.
    // - on an error, the step's status is 'failed', and it follows its 'failure' edge
    // - an end step sets the outcome, and has no next step
    // - push a StepTrace (see types.ts), emit { type: 'step-end', trace }, and set current to trace.next
    throw new Error('TODO: the workflow loop');
  }

  const run: RunRecord = {
    id: newRunId(),
    workflowId: workflow.id,
    mode: 'workflow',
    emailId: input.emailId ?? null,
    email: input.email,
    startedAt: new Date(runStart).toISOString(),
    durationMs: clock() - runStart,
    outcome,
    reply,
    context,
    steps,
  };
  onEvent?.({ type: 'run-end', run });
  return run;
}
