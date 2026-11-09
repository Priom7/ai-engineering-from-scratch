// The support desk API: the workflow, emails, runs (with live step events) and experiment results.

export type Outcome = 'ready' | 'review' | 'escalated' | 'failed';
export type NodeType = 'llm-json' | 'llm-text' | 'retrieve' | 'judge' | 'condition' | 'end';

export interface WorkflowNode {
  id: string;
  title: string;
  type: NodeType;
  position: { x: number; y: number };
  model?: string;
  outcome?: Outcome;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  kind: 'next' | 'true' | 'false' | 'failure';
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  start: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface StepTrace {
  nodeId: string;
  title: string;
  type: NodeType;
  startMs: number;
  durationMs: number;
  modelMs: number;
  loadMs: number;
  attempts: { attempt: number; raw: string | null; error: string | null }[];
  status: 'ok' | 'failed';
  output: unknown;
  error: string | null;
  next: string | null;
}

export interface RunRecord {
  id: string;
  mode: 'workflow' | 'single';
  emailId: string | null;
  email: string;
  startedAt: string;
  durationMs: number;
  outcome: Outcome;
  reply: string | null;
  context: Record<string, unknown>;
  steps: StepTrace[];
}

export type RunSummary = Omit<RunRecord, 'steps' | 'context'>;

export type RunEvent = { type: 'step-start'; nodeId: string } | { type: 'step-end'; trace: StepTrace } | { type: 'run-end'; run: RunRecord };

export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  pasted?: boolean;
  expected?: { intent: string; route: string };
}

export interface ExperimentResult {
  emailId: string;
  mode: 'workflow' | 'single';
  outcome: Outcome;
  expectedRoute: string;
  replyCorrect: boolean | null;
  sentWrong: boolean;
  caught: boolean;
  intentCorrect: boolean | null;
  jsonFirstTry: boolean | null;
  jsonAttempts: number | null;
  durationMs: number;
  reply: string | null;
  gradeReason: string;
}

export interface Experiment {
  name: string;
  mode: 'workflow' | 'single';
  createdAt: string;
  settings: { answerModel: string; checkModel: string | null; useFormat: boolean | null; graderModel: string };
  summary: {
    emails: number;
    sentWrong: number;
    sentRight: number;
    caught: number;
    ready: number;
    review: number;
    escalated: number;
    failed: number;
    escalationCorrect: number;
    reviewedButCorrect: number;
    intentAccuracy: number | null;
    jsonFirstTry: number | null;
    jsonAfterRetry: number | null;
    medianSeconds: number | null;
    stepMedians: Record<string, number | null>;
  };
  results: ExperimentResult[];
}

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4400';

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message ?? 'Request failed.');
  return data;
}

export const fetchHealth = () => readJson<{ ok: boolean; documents: number; chunks: number; models: string[] }>('/api/health');
export const fetchWorkflow = () => readJson<Workflow>('/api/workflow');
export const fetchEmails = () => readJson<{ emails: Email[] }>('/api/emails');
export const fetchRuns = () => readJson<{ runs: RunSummary[] }>('/api/runs');
export const fetchRun = (id: string) => readJson<RunRecord>(`/api/runs/${encodeURIComponent(id)}`);
export const fetchExperiments = () => readJson<{ experiments: Experiment[] }>('/api/experiments');

export const addEmail = (email: { from: string; subject: string; body: string }) =>
  readJson<Email>('/api/emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(email) });

export const startRun = (input: { emailId: string; mode: 'workflow' | 'single' }) =>
  readJson<{ runId: string }>('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });

/** Follows a run step by step. Returns a function that stops listening. */
export function followRun(runId: string, onEvent: (event: RunEvent) => void): () => void {
  const source = new EventSource(`${apiBaseUrl}/api/runs/${encodeURIComponent(runId)}/events`);
  source.onmessage = (message) => {
    const event = JSON.parse(message.data) as RunEvent;
    onEvent(event);
    if (event.type === 'run-end') source.close();
  };
  source.onerror = () => source.close();
  return () => source.close();
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  ready: 'Ready to send',
  review: 'Needs review',
  escalated: 'Escalated',
  failed: 'Failed',
};
