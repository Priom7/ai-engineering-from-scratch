// A workflow is data: nodes (steps) and edges (what runs next). The engine
// walks it; the app draws it. Each step reads from and writes to one shared
// context object, under its `output` key.

export type Outcome = 'ready' | 'review' | 'escalated' | 'failed';

type Base = {
  id: string;
  title: string;
  /** Where the app draws the step. */
  position: { x: number; y: number };
  /** Give up on the step after this long (default 120 s) and follow its failure edge. */
  timeoutMs?: number;
};

/** Ask a model for JSON, check it against a schema, and retry with the errors. */
export type LlmJsonNode = Base & {
  type: 'llm-json';
  model: string;
  system: string;
  /** Template: {{email}}, {{someStep.field}}. */
  prompt: string;
  schema: object;
  output: string;
  maxRetries: number;
  /** Also pass the schema to Ollama, which constrains the reply to it. The reply is still validated. */
  useFormat?: boolean;
  temperature?: number;
};

/** Ask a model for text. */
export type LlmTextNode = Base & { type: 'llm-text'; model: string; system: string; prompt: string; output: string };

/** Find the closest document chunks to a query. */
export type RetrieveNode = Base & { type: 'retrieve'; query: string; topK: number; output: string };

/** Check that every claim in an answer is backed by the retrieved context. */
export type JudgeNode = Base & { type: 'judge'; model: string; answerFrom: string; contextFrom: string; output: string };

/** Branch: true when every rule matches. */
export type ConditionNode = Base & {
  type: 'condition';
  all: { key: string; equals?: string | number | boolean; in?: (string | number)[] }[];
};

/** Finish the run with an outcome. */
export type EndNode = Base & { type: 'end'; outcome: Exclude<Outcome, 'failed'> };

export type WorkflowNode = LlmJsonNode | LlmTextNode | RetrieveNode | JudgeNode | ConditionNode | EndNode;

export type EdgeKind = 'next' | 'true' | 'false' | 'failure';
export type WorkflowEdge = { id: string; from: string; to: string; kind: EdgeKind; label?: string };

export type Workflow = { id: string; name: string; start: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export type AttemptTrace = { attempt: number; raw: string | null; error: string | null };

/** What one step did: for the inspector, the timeline and the experiments. */
export type StepTrace = {
  nodeId: string;
  title: string;
  type: WorkflowNode['type'];
  /** When the step started, in ms after the run started. */
  startMs: number;
  durationMs: number;
  /** Time the model spent working (prompt + generation), excluding loading. */
  modelMs: number;
  /** Time spent loading a model into memory before it could work. */
  loadMs: number;
  attempts: AttemptTrace[];
  status: 'ok' | 'failed';
  output: unknown;
  error: string | null;
  /** The step that ran next, or null at the end. */
  next: string | null;
};

export type RunRecord = {
  id: string;
  workflowId: string;
  mode: 'workflow' | 'single';
  emailId: string | null;
  email: string;
  startedAt: string;
  durationMs: number;
  outcome: Outcome;
  /** The drafted reply, if the run got that far. */
  reply: string | null;
  context: Record<string, unknown>;
  steps: StepTrace[];
};

export type RunEvent = { type: 'step-start'; nodeId: string } | { type: 'step-end'; trace: StepTrace } | { type: 'run-end'; run: RunRecord };
