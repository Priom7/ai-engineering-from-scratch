import { Braces, Flag, GitBranch, PenLine, Search, Send, ShieldCheck, Siren, UserCheck } from 'lucide-react';
import { Handle, Position, type NodeProps } from 'reactflow';

import type { Outcome, WorkflowNode } from '../api';
import { cn } from '../lib/utils';

export type StepStatus = 'idle' | 'running' | 'ok' | 'failed' | 'skipped';
export type StepNodeData = { node: WorkflowNode; status: StepStatus; selected: boolean; hasFailure: boolean };

const ICONS = { 'llm-json': Braces, condition: GitBranch, retrieve: Search, 'llm-text': PenLine, judge: ShieldCheck, end: Flag };
const END_ICONS = { ready: Send, review: UserCheck, escalated: Siren, failed: Flag };
const KIND = { 'llm-json': 'Model · JSON', condition: 'Branch', retrieve: 'Retrieval', 'llm-text': 'Model · text', judge: 'Check', end: 'Outcome' };

// A reached outcome takes the colour of what happens to the email next.
const OUTCOME_TONE: Record<Outcome, { border: string; icon: string }> = {
  ready: { border: 'border-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.15)]', icon: 'bg-emerald-400/20 text-emerald-200' },
  review: { border: 'border-amber-300 shadow-[0_0_0_6px_rgba(252,211,77,0.15)]', icon: 'bg-amber-300/20 text-amber-200' },
  escalated: { border: 'border-rose-400 shadow-[0_0_0_6px_rgba(251,113,133,0.15)]', icon: 'bg-rose-400/20 text-rose-200' },
  failed: { border: 'border-rose-400', icon: 'bg-rose-400/20 text-rose-200' },
};

const handle = '!h-1.5 !w-1.5 !min-w-0 !border-0';

/** One step in the diagram: what it is, which model it uses, and its state in the current run. */
export function StepNode({ data }: NodeProps<StepNodeData>) {
  const { node, status, selected, hasFailure } = data;
  const Icon = node.type === 'end' && node.outcome ? END_ICONS[node.outcome] : ICONS[node.type];
  const reached = node.type === 'end' && node.outcome && status === 'ok' ? OUTCOME_TONE[node.outcome] : null;
  return (
    <div
      className={cn(
        'relative w-[184px] cursor-pointer rounded-2xl border-2 bg-slate-900/95 px-3.5 py-3 shadow-panel transition-all duration-300',
        status === 'idle' && 'border-white/10',
        status === 'running' && 'border-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.18)]',
        status === 'ok' && (reached?.border ?? 'border-emerald-400/80'),
        status === 'failed' && 'border-rose-400',
        status === 'skipped' && 'border-white/5 opacity-40',
        selected && 'ring-2 ring-sky-300/60 ring-offset-2 ring-offset-slate-950',
      )}
    >
      <Handle type="target" position={Position.Left} className={cn(handle, '!bg-slate-600')} />
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            reached?.icon ??
              (status === 'running' ? 'bg-cyan-400/20 text-cyan-200' : status === 'ok' ? 'bg-emerald-400/15 text-emerald-200' : status === 'failed' ? 'bg-rose-400/15 text-rose-200' : 'bg-white/5 text-slate-300'),
          )}
        >
          <Icon className={cn('h-4 w-4', status === 'running' && 'animate-pulse')} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">{node.title}</p>
          <p className="truncate text-xs text-slate-400">{KIND[node.type]}</p>
        </div>
      </div>
      {node.model ? <p className="mt-2 truncate rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300">{node.model}</p> : null}
      {node.type === 'end' ? null : <Handle id="out" type="source" position={Position.Right} className={cn(handle, '!bg-slate-600')} />}
      {hasFailure ? <Handle id="fail" type="source" position={Position.Bottom} className={cn(handle, '!bg-rose-400/50')} /> : null}
    </div>
  );
}
