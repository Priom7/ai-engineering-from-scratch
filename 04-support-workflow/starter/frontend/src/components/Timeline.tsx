import type { StepTrace } from '../api';

/** Where the run's seconds went: one bar per step, model time and model loading shown apart. */
export function Timeline({ steps, totalMs }: { steps: StepTrace[]; totalMs: number }) {
  const timed = steps.filter((s) => s.durationMs > 30);
  if (timed.length === 0) return <p className="text-sm text-slate-400">The timeline appears as steps finish.</p>;
  const total = Math.max(totalMs, ...timed.map((s) => s.startMs + s.durationMs), 1);
  return (
    <div className="space-y-2.5">
      {timed.map((s) => {
        const left = (s.startMs / total) * 100;
        const loadW = (s.loadMs / total) * 100;
        const restW = ((s.durationMs - s.loadMs) / total) * 100;
        return (
          <div key={s.nodeId + s.startMs} className="grid grid-cols-[110px_1fr_64px] items-center gap-3">
            <span className="truncate text-sm text-slate-300">{s.title}</span>
            <div className="relative h-6 rounded-md bg-white/[0.04]">
              <div className="absolute inset-y-0 flex overflow-hidden rounded-md" style={{ left: `${left}%`, width: `${loadW + restW}%` }}>
                {s.loadMs > 0 ? <div className="h-full bg-amber-400/70" style={{ width: `${(loadW / (loadW + restW)) * 100}%` }} title="Loading the model" /> : null}
                <div className="h-full flex-1 bg-cyan-400" title="Working" />
              </div>
            </div>
            <span className="text-right text-sm tabular-nums text-slate-300">{(s.durationMs / 1000).toFixed(1)} s</span>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" /> model working
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/70" /> loading the model into memory
        </span>
        <span className="ml-auto">total {(totalMs / 1000).toFixed(1)} s</span>
      </div>
    </div>
  );
}
