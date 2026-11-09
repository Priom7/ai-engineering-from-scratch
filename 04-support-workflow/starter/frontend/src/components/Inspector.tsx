import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';

import type { StepTrace } from '../api';
import { cn } from '../lib/utils';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function Output({ trace }: { trace: StepTrace }) {
  const output = trace.output as Record<string, unknown> | string | boolean | null;
  if (trace.type === 'retrieve' && output && typeof output === 'object') {
    const matches = (output as { matches: { documentName: string; score: number; text: string }[] }).matches;
    return (
      <div className="space-y-2">
        {matches.map((m, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-mono text-slate-200">
                [Source {i + 1}] {m.documentName}
              </span>
              <span className="text-cyan-300">score {m.score.toFixed(2)}</span>
            </div>
            <p className="line-clamp-2 text-sm text-slate-400">{m.text}</p>
          </div>
        ))}
      </div>
    );
  }
  if (trace.type === 'judge' && output && typeof output === 'object') {
    const check = output as { supported: boolean; reason: string; unsupportedClaims: string[] };
    return (
      <div className="space-y-3">
        <p className={cn('flex items-center gap-2 text-[15px] font-semibold', check.supported ? 'text-emerald-300' : 'text-rose-300')}>
          {check.supported ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {check.supported ? 'Every claim is backed by the sources' : 'Unsupported claims found'}
        </p>
        <p className="text-sm leading-6 text-slate-300">{check.reason}</p>
        {check.unsupportedClaims.map((claim, i) => (
          <p key={i} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            “{claim}”
          </p>
        ))}
      </div>
    );
  }
  if (typeof output === 'string') return <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-100">{output}</p>;
  if (typeof output === 'boolean') return <p className="text-[15px] text-slate-100">Condition is {output ? 'true' : 'false'} → took the “{output ? 'true' : 'false'}” edge</p>;
  return <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 font-mono text-sm leading-6 text-slate-100">{JSON.stringify(output, null, 2)}</pre>;
}

/** Everything one step did: its output, every attempt, and where its time went. */
export function Inspector({ trace }: { trace: StepTrace | null }) {
  if (!trace) return <p className="text-sm text-slate-400">Run an email, then click a step to see what it did.</p>;
  const retried = trace.attempts.length > 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cn('rounded-full px-2.5 py-1 font-semibold', trace.status === 'ok' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200')}>
          {trace.status === 'ok' ? 'OK' : 'Failed'}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-slate-300">
          <Clock3 className="h-3.5 w-3.5" />
          {seconds(trace.durationMs)}
          {trace.loadMs > 0 ? ` (model ${seconds(trace.modelMs)}, loading ${seconds(trace.loadMs)})` : ''}
        </span>
        {retried ? <span className="rounded-full bg-amber-400/15 px-2.5 py-1 font-semibold text-amber-200">{trace.attempts.length} attempts</span> : null}
      </div>
      {trace.error ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{trace.error}</p> : null}
      {retried
        ? trace.attempts
            .filter((a) => a.error)
            .map((a) => (
              <div key={a.attempt} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm">
                <p className="mb-1 font-semibold text-amber-200">Attempt {a.attempt} rejected: {a.error}</p>
                <p className="line-clamp-3 font-mono text-xs text-slate-400">{a.raw}</p>
              </div>
            ))
        : null}
      {trace.output !== null && trace.output !== undefined ? <Output trace={trace} /> : null}
    </div>
  );
}
