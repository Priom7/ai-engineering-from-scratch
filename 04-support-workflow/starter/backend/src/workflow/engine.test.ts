import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ChatRequest, ChatResult } from '../ollama.js';
import { runWorkflow, type StepDeps } from './engine.js';
import type { RunEvent, Workflow, WorkflowEdge, WorkflowNode } from './types.js';

const at = { x: 0, y: 0 };
const schema = { type: 'object', properties: { intent: { type: 'string' } }, required: ['intent'] };

const understand: WorkflowNode = {
  id: 'understand',
  title: 'Understand',
  position: at,
  type: 'llm-json',
  model: 'small',
  system: 'Classify.',
  prompt: '{{email}}',
  schema,
  output: 'understand',
  maxRetries: 1,
};
const isRefund: WorkflowNode = { id: 'is-refund', title: 'Refund?', position: at, type: 'condition', all: [{ key: 'understand.intent', equals: 'refund' }] };
const ready: WorkflowNode = { id: 'ready', title: 'Ready', position: at, type: 'end', outcome: 'ready' };
const review: WorkflowNode = { id: 'review', title: 'Review', position: at, type: 'end', outcome: 'review' };
const edge = (from: string, to: string, kind: WorkflowEdge['kind'] = 'next'): WorkflowEdge => ({ id: `${from}-${to}`, from, to, kind });

const flow = (nodes: WorkflowNode[], edges: WorkflowEdge[], start = nodes[0].id): Workflow => ({ id: 'test', name: 'Test', start, nodes, edges });

function fakeDeps(replies: (string | Error | (() => Promise<string>))[], timing = { durationMs: 100, loadDurationMs: 0 }) {
  const requests: ChatRequest[] = [];
  const deps: StepDeps = {
    chat: async (request): Promise<ChatResult> => {
      requests.push(request);
      const next = replies.shift() ?? '';
      if (next instanceof Error) throw next;
      const content = typeof next === 'function' ? await next() : next;
      return { model: request.model, content, ...timing, promptTokens: 0, responseTokens: 0 };
    },
    retrieve: async () => [],
  };
  return { deps, requests };
}

test('follows next edges to an end node and records its outcome', async () => {
  const { deps } = fakeDeps(['{"intent":"refund"}']);
  const run = await runWorkflow(flow([understand, ready], [edge('understand', 'ready')]), { email: 'Refund please' }, deps);
  assert.equal(run.outcome, 'ready');
  assert.deepEqual(run.context.understand, { intent: 'refund' });
  assert.deepEqual(
    run.steps.map((s) => s.nodeId),
    ['understand', 'ready'],
  );
});

test('takes the true or false edge from a condition', async () => {
  const workflow = flow(
    [understand, isRefund, ready, review],
    [edge('understand', 'is-refund'), edge('is-refund', 'ready', 'true'), edge('is-refund', 'review', 'false')],
  );
  assert.equal((await runWorkflow(workflow, { email: 'x' }, fakeDeps(['{"intent":"refund"}']).deps)).outcome, 'ready');
  assert.equal((await runWorkflow(workflow, { email: 'x' }, fakeDeps(['{"intent":"other"}']).deps)).outcome, 'review');
});

test('retries invalid JSON with the error, then succeeds', async () => {
  const { deps, requests } = fakeDeps(['It is a refund.', '{"intent":"refund"}']);
  const run = await runWorkflow(flow([understand, ready], [edge('understand', 'ready')]), { email: 'x' }, deps);
  assert.equal(run.outcome, 'ready');
  assert.equal(run.steps[0].attempts.length, 2);
  assert.match(requests[1].user, /invalid/);
});

test('follows the failure edge after maxRetries', async () => {
  const { deps } = fakeDeps(['nope', 'still nope']);
  const run = await runWorkflow(flow([understand, ready, review], [edge('understand', 'ready'), edge('understand', 'review', 'failure')]), { email: 'x' }, deps);
  assert.equal(run.outcome, 'review');
  assert.equal(run.steps[0].status, 'failed');
  assert.equal(run.steps[0].attempts.length, 2);
});

test('ends failed with the error when chat throws and there is no failure edge', async () => {
  const { deps } = fakeDeps([new Error('connect ECONNREFUSED 127.0.0.1:11434'), new Error('connect ECONNREFUSED 127.0.0.1:11434')]);
  const run = await runWorkflow(flow([understand, ready], [edge('understand', 'ready')]), { email: 'x' }, deps);
  assert.equal(run.outcome, 'failed');
  assert.match(run.steps[0].error ?? '', /ECONNREFUSED/);
});

test('times out a slow step and follows the failure edge', async () => {
  const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve('{"intent":"refund"}'), 100));
  const { deps } = fakeDeps([slow]);
  const quick = { ...understand, timeoutMs: 20 } as WorkflowNode;
  const run = await runWorkflow(flow([quick, ready, review], [edge('understand', 'ready'), edge('understand', 'review', 'failure')]), { email: 'x' }, deps);
  assert.equal(run.outcome, 'review');
  assert.match(run.steps[0].error ?? '', /timed out/i);
});

test('records model time and load time separately', async () => {
  const { deps } = fakeDeps(['{"intent":"refund"}'], { durationMs: 900, loadDurationMs: 600 });
  const run = await runWorkflow(flow([understand, ready], [edge('understand', 'ready')]), { email: 'x' }, deps);
  assert.equal(run.steps[0].loadMs, 600);
  assert.equal(run.steps[0].modelMs, 300);
});

test('emits step-start and step-end for every step, then run-end', async () => {
  const events: RunEvent['type'][] = [];
  await runWorkflow(flow([understand, ready], [edge('understand', 'ready')]), { email: 'x' }, fakeDeps(['{"intent":"refund"}']).deps, (e) => events.push(e.type));
  assert.deepEqual(events, ['step-start', 'step-end', 'step-start', 'step-end', 'run-end']);
});

test('stops after 50 steps on a cycle', async () => {
  const loop: WorkflowNode = { id: 'loop', title: 'Loop', position: at, type: 'condition', all: [] };
  const run = await runWorkflow(flow([loop], [edge('loop', 'loop', 'true')]), { email: 'x' }, fakeDeps([]).deps);
  assert.equal(run.outcome, 'failed');
  assert.equal(run.steps.length, 50);
});

test('writes the retrieved chunks and their context for later steps', async () => {
  const find: WorkflowNode = { id: 'find', title: 'Find', position: at, type: 'retrieve', query: '{{email}}', topK: 2, output: 'find' };
  const deps: StepDeps = {
    ...fakeDeps([]).deps,
    retrieve: async (query, topK) => [{ chunkId: 'c1', documentId: 'd', documentName: 'refunds.md', score: 0.8, text: `${query} (top ${topK})` }],
  };
  const run = await runWorkflow(flow([find, ready], [edge('find', 'ready')]), { email: 'refund?' }, deps);
  assert.match((run.context.find as { context: string }).context, /\[Source 1: refunds.md\]\nrefund\? \(top 2\)/);
});
