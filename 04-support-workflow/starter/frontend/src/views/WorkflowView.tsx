import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, MarkerType, type Dimensions, type Edge, type Node, type NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertTriangle, LoaderCircle, Mail, Play, Send, Siren, UserCheck } from 'lucide-react';

import { followRun, OUTCOME_LABEL, startRun, type Email, type RunRecord, type StepTrace, type Workflow } from '../api';
import { Inspector } from '../components/Inspector';
import { StepNode, type StepNodeData, type StepStatus } from '../components/StepNode';
import { Timeline } from '../components/Timeline';
import { cn } from '../lib/utils';

type Mode = 'workflow' | 'single';

const nodeTypes = { step: StepNode };

// Episode 2's app drawn as a workflow, so the two can be compared on the same email.
const SINGLE_PROMPT: Workflow = {
  id: 'single-prompt',
  name: 'Single prompt',
  start: 'find',
  nodes: [
    { id: 'find', title: 'Find', type: 'retrieve', position: { x: 0, y: 0 } },
    { id: 'answer', title: 'Answer', type: 'llm-text', model: 'llama3.2:3b', position: { x: 260, y: 0 } },
    { id: 'sent', title: 'Sent', type: 'end', outcome: 'ready', position: { x: 520, y: 0 } },
  ],
  edges: [
    { id: 'find-answer', from: 'find', to: 'answer', kind: 'next' },
    { id: 'answer-sent', from: 'answer', to: 'sent', kind: 'next' },
  ],
};

const OUTCOME_STYLE = {
  ready: { icon: Send, tone: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' },
  review: { icon: UserCheck, tone: 'border-amber-300/30 bg-amber-300/10 text-amber-100' },
  escalated: { icon: Siren, tone: 'border-rose-400/30 bg-rose-400/10 text-rose-100' },
  failed: { icon: AlertTriangle, tone: 'border-rose-400/30 bg-rose-400/10 text-rose-100' },
};

function outcomeNote(run: RunRecord): string {
  if (run.mode === 'single') return 'The single prompt sends every reply. Nothing checks it first.';
  const check = run.context.check as { reason?: string } | undefined;
  if (run.outcome === 'ready') return 'Every claim in the reply is backed by the sources.';
  if (run.outcome === 'escalated') return 'A high-urgency outage goes straight to the on-call team. No reply is drafted.';
  if (run.outcome === 'review') return check?.reason ? `A person checks this reply before it goes out. ${check.reason}` : 'A step failed, so a person handles this email.';
  return String(run.context.error ?? 'The run failed.');
}

/** The step to show while following a run: the latest one that did real work. */
const latestWork = (steps: StepTrace[]) => [...steps].reverse().find((s) => s.type !== 'condition' && s.type !== 'end')?.nodeId ?? null;

export function WorkflowView({ workflow, emails, emailId, onEmailChange }: { workflow: Workflow; emails: Email[]; emailId: string; onEmailChange: (id: string) => void }) {
  const [mode, setMode] = useState<Mode>('workflow');
  const [steps, setSteps] = useState<StepTrace[]>([]);
  const [runningNode, setRunningNode] = useState<string | null>(null);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState('');
  // React Flow measures each node and hides any node without a size, so the sizes are passed back on every render.
  const [sizes, setSizes] = useState<Record<string, Dimensions>>({});
  const stop = useRef<() => void>(() => undefined);
  // Event handlers read the latest "following" flag without re-subscribing.
  const followingRef = useRef(following);
  followingRef.current = following;

  const graph = mode === 'single' ? SINGLE_PROMPT : workflow;
  const email = emails.find((e) => e.id === emailId);

  useEffect(() => () => stop.current(), []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [busy]);

  function reset() {
    stop.current();
    setSteps([]);
    setRun(null);
    setRunningNode(null);
    setSelected(null);
    setBusy(false);
    setError('');
  }

  async function handleRun() {
    if (!emailId || busy) return;
    reset();
    setBusy(true);
    setFollowing(true);
    setStartedAt(Date.now());
    setNow(Date.now());
    // The single prompt reports nothing until it finishes.
    if (mode === 'single') setRunningNode('answer');
    try {
      const { runId } = await startRun({ emailId, mode });
      stop.current = followRun(runId, (event) => {
        if (event.type === 'step-start') setRunningNode(event.nodeId);
        if (event.type === 'step-end') {
          setRunningNode(null);
          setSteps((previous) => [...previous, event.trace]);
          if (event.trace.type !== 'condition' && event.trace.type !== 'end') setSelected((current) => (followingRef.current ? event.trace.nodeId : current));
        }
        if (event.type === 'run-end') {
          setRunningNode(null);
          setSteps(event.run.steps);
          setRun(event.run);
          setBusy(false);
          if (followingRef.current) setSelected(latestWork(event.run.steps));
        }
      });
    } catch (runError) {
      setBusy(false);
      setRunningNode(null);
      setError(runError instanceof Error ? runError.message : 'The run could not start.');
    }
  }

  const traces = useMemo(() => new Map(steps.map((s) => [s.nodeId, s])), [steps]);
  const taken = useMemo(() => {
    const pairs = new Set(steps.filter((s) => s.next).map((s) => `${s.nodeId}>${s.next}`));
    if (run?.mode === 'single') pairs.add('answer>sent');
    return pairs;
  }, [steps, run]);

  function statusOf(id: string): StepStatus {
    if (runningNode === id) return 'running';
    const trace = traces.get(id);
    if (trace) return trace.status === 'ok' ? 'ok' : 'failed';
    if (run?.mode === 'single' && id === 'sent') return 'ok';
    return run || busy ? 'skipped' : 'idle';
  }

  const nodes: Node<StepNodeData>[] = graph.nodes.map((node) => ({
    id: node.id,
    type: 'step',
    position: node.position,
    ...sizes[node.id],
    data: { node, status: statusOf(node.id), selected: selected === node.id, hasFailure: graph.edges.some((e) => e.from === node.id && e.kind === 'failure') },
  }));

  function handleNodesChange(changes: NodeChange[]) {
    const measured = changes.flatMap((c) => (c.type === 'dimensions' && c.dimensions ? [[c.id, c.dimensions] as const] : []));
    if (measured.length) setSizes((current) => ({ ...current, ...Object.fromEntries(measured) }));
  }

  const edges: Edge[] = graph.edges.map((e) => {
    const isTaken = taken.has(`${e.from}>${e.to}`);
    const failure = e.kind === 'failure';
    const color = isTaken ? (failure ? '#fb7185' : '#22d3ee') : failure ? 'rgba(251,113,133,0.3)' : 'rgba(148,163,184,0.45)';
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle: failure ? 'fail' : 'out',
      type: 'smoothstep',
      animated: isTaken,
      label: failure && !isTaken ? undefined : e.label,
      labelStyle: { fill: isTaken ? '#e2e8f0' : '#94a3b8', fontSize: 13, fontWeight: 600 },
      labelBgStyle: { fill: '#0b1222' },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 6,
      style: { stroke: color, strokeWidth: isTaken ? 2.5 : 1.5, ...(failure ? { strokeDasharray: '5 5' } : {}) },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      zIndex: isTaken ? 1 : 0,
    };
  });

  const elapsed = busy ? now - startedAt : (run?.durationMs ?? 0);
  const runningTitle = graph.nodes.find((n) => n.id === runningNode)?.title;
  const selectedTrace = selected ? (traces.get(selected) ?? null) : null;
  const inspectable = steps.filter((s) => s.type !== 'end');
  const outcome = run ? OUTCOME_STYLE[run.outcome] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
          <Mail className="h-4 w-4 shrink-0 text-slate-400" />
          <select
            aria-label="Email to run"
            value={emailId}
            onChange={(event) => {
              reset();
              onEmailChange(event.target.value);
            }}
            className="h-11 w-full min-w-0 bg-transparent text-[15px] text-slate-100 outline-none [&>option]:bg-slate-900"
          >
            {emails.map((e) => (
              <option key={e.id} value={e.id}>
                {e.subject} · {e.from}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/60 p-1" role="group" aria-label="How to answer">
          {(
            [
              ['workflow', 'Workflow'],
              ['single', 'Single prompt'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => {
                reset();
                setMode(id);
              }}
              className={cn('rounded-lg px-4 py-2 text-sm font-medium', mode === id ? 'bg-sky-400/20 text-sky-100' : 'text-slate-400 hover:text-slate-200')}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={busy || !emailId}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-400 px-5 text-[15px] font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {busy ? 'Running' : 'Run'}
        </button>
        <span className="min-w-[180px] text-sm tabular-nums text-slate-300">
          {busy ? `${runningTitle ? `${runningTitle}… ` : ''}${(elapsed / 1000).toFixed(1)} s` : run ? `Finished in ${(elapsed / 1000).toFixed(1)} s` : ''}
        </span>
      </div>

      {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

      <div className="relative h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
        <ReactFlow
          key={graph.id}
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          onNodeClick={(_, node) => {
            setFollowing(false);
            setSelected(node.id);
          }}
        >
          <Background color="rgba(148,163,184,0.15)" gap={24} />
        </ReactFlow>
        <div className="pointer-events-none absolute left-4 top-3 flex items-center gap-4 text-xs text-slate-400">
          <span className="text-sm font-semibold text-slate-200">{graph.name}</span>
          {mode === 'workflow' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-rose-400/50" /> when a step fails
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <p className="mb-1 text-sm text-slate-400">From {email?.from ?? '…'}</p>
            <h2 className="mb-3 text-lg font-semibold text-white">{email?.subject ?? 'Pick an email'}</h2>
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-300">{email?.body}</p>
          </section>
          {run && outcome ? (
            <section className={cn('rounded-2xl border p-5', outcome.tone)}>
              <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <outcome.icon className="h-5 w-5" />
                {run.mode === 'single' ? 'Sent to the customer' : OUTCOME_LABEL[run.outcome]}
              </div>
              <p className="mb-4 text-sm leading-6 opacity-90">{outcomeNote(run)}</p>
              {run.reply ? <p className="whitespace-pre-wrap rounded-xl bg-slate-950/60 p-4 text-[15px] leading-7 text-slate-100">{run.reply}</p> : null}
            </section>
          ) : null}
        </div>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-lg font-semibold text-white">Step details</h2>
            {inspectable.map((s) => (
              <button
                key={s.nodeId}
                type="button"
                onClick={() => {
                  setFollowing(false);
                  setSelected(s.nodeId);
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  selected === s.nodeId ? 'border-sky-300/50 bg-sky-400/20 text-sky-100' : 'border-white/10 text-slate-400 hover:text-slate-200',
                  s.status === 'failed' && 'border-rose-400/40 text-rose-200',
                )}
              >
                {s.title}
              </button>
            ))}
          </div>
          <Inspector trace={selectedTrace} />
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">Where the time went</h2>
        <Timeline steps={steps} totalMs={busy ? elapsed : (run?.durationMs ?? 0)} />
      </section>
    </div>
  );
}
