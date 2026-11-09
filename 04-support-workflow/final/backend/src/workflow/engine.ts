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
      const prompt = render(node.prompt, context);
      let user = prompt;
      for (let attempt = 1; attempt <= node.maxRetries + 1; attempt += 1) {
        const raw = await callModel(deps, meter, {
          model: node.model,
          system: node.system,
          user,
          ...(node.temperature !== undefined ? { temperature: node.temperature } : {}),
          ...(node.useFormat ? { format: node.schema } : {}),
        });
        const checked = parseAndValidate(raw, node.schema);
        meter.attempts.push({ attempt, raw, error: checked.ok ? null : checked.error });
        if (checked.ok) return { output: checked.value };
        // Retry with the exact validation error, so the model can fix it.
        user = `${prompt}\n\n${retryPrompt(raw, checked.error)}`;
      }
      throw new Error(`No valid JSON after ${node.maxRetries + 1} attempts: ${meter.attempts.at(-1)?.error}`);
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
      const branch = node.all.every((rule) => {
        const value = lookup(context, rule.key);
        if (rule.equals !== undefined && value !== rule.equals) return false;
        if (rule.in !== undefined && !rule.in.includes(value as string | number)) return false;
        return true;
      });
      return { output: branch, branch };
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
    onEvent?.({ type: 'step-start', nodeId: node.id });

    const started = clock();
    const meter: Meter = { attempts: [], modelMs: 0, loadMs: 0 };
    let status: StepTrace['status'] = 'ok';
    let output: unknown = null;
    let error: string | null = null;
    let kind: EdgeKind = 'next';
    try {
      const result = await withTimeout(executeStep(node, context, deps, meter), node.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      output = result.output;
      if (node.type !== 'end' && node.type !== 'condition') context[node.output] = output;
      if (node.type === 'llm-text') reply = output as string;
      if (node.type === 'condition') kind = result.branch ? 'true' : 'false';
    } catch (e) {
      status = 'failed';
      error = message(e);
      kind = 'failure';
    }

    const edge = node.type === 'end' ? undefined : workflow.edges.find((e) => e.from === node.id && e.kind === kind);
    if (node.type === 'end') outcome = node.outcome;
    const trace: StepTrace = {
      nodeId: node.id,
      title: node.title,
      type: node.type,
      startMs: started - runStart,
      durationMs: clock() - started,
      modelMs: meter.modelMs,
      loadMs: meter.loadMs,
      attempts: meter.attempts,
      status,
      output,
      error: error ?? (node.type !== 'end' && !edge ? `No "${kind}" edge from ${node.id}.` : null),
      next: edge?.to ?? null,
    };
    steps.push(trace);
    onEvent?.({ type: 'step-end', trace });
    current = trace.next;
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
