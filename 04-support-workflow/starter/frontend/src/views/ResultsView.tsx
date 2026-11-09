import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Siren } from 'lucide-react';

import { fetchExperiments, OUTCOME_LABEL, type Experiment, type ExperimentResult } from '../api';
import { cn } from '../lib/utils';

// What happened to each email, from best to worst. The order keeps neighbouring
// colours distinguishable (checked for colour-blind readers), and every colour
// also has a label in the legend, the tooltip and the table below.
type Segment = 'sentRight' | 'escalated' | 'caught' | 'reviewedCorrect' | 'stepFailed' | 'missedOutage' | 'sentWrong';
const SEGMENTS: { id: Segment; label: string; color: string; ink: string }[] = [
  { id: 'sentRight', label: 'Right reply sent', color: '#0ca30c', ink: '#04130a' },
  { id: 'escalated', label: 'Outage escalated', color: '#9085e9', ink: '#0c0a24' },
  { id: 'caught', label: 'Wrong draft stopped for review', color: '#fab219', ink: '#1f1500' },
  { id: 'reviewedCorrect', label: 'Right draft sent to review', color: '#8b93a1', ink: '#0b1020' },
  { id: 'stepFailed', label: 'A step failed', color: '#4b5361', ink: '#f1f5f9' },
  { id: 'missedOutage', label: 'Outage answered, not escalated', color: '#ec835a', ink: '#220d04' },
  { id: 'sentWrong', label: 'Wrong reply sent', color: '#d03b3b', ink: '#fff1f1' },
];

function segmentOf(r: ExperimentResult): Segment {
  if (r.outcome === 'failed') return 'stepFailed';
  if (r.outcome === 'escalated') return 'escalated';
  if (r.outcome === 'ready') {
    if (r.expectedRoute === 'escalated') return 'missedOutage';
    return r.replyCorrect === false ? 'sentWrong' : 'sentRight';
  }
  if (r.replyCorrect === null) return 'stepFailed';
  return r.replyCorrect ? 'reviewedCorrect' : 'caught';
}

const ORDER = ['single', 'workflow', 'workflow-3b-check', 'workflow-no-format'];
const NAMES: Record<string, string> = {
  single: 'Single prompt',
  workflow: 'Workflow',
  'workflow-3b-check': 'Workflow, 3B check',
  'workflow-no-format': 'Workflow, JSON mode off',
};
const nameOf = (e: Experiment) => NAMES[e.name] ?? e.name;
const short = (model: string | null) => (model ? model.replace(/:.*$/, '').replace('qwen2.5', 'Qwen 7B').replace('llama3.2', 'Llama 3B') : '');

function describe(e: Experiment) {
  if (e.mode === 'single') return `One ${short(e.settings.answerModel)} call, no check`;
  return `Draft ${short(e.settings.answerModel)} · check ${short(e.settings.checkModel)}${e.settings.useFormat === false ? ' · Ollama JSON mode off' : ''}`;
}

const pct = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);

type Hover = { x: number; y: number; title: string; lines: string[] };

function Tooltip({ hover }: { hover: Hover | null }) {
  if (!hover) return null;
  return (
    <div className="pointer-events-none fixed z-50 max-w-xs rounded-xl border border-white/15 bg-slate-950/95 px-3 py-2 text-sm shadow-panel" style={{ left: hover.x + 14, top: hover.y + 14 }}>
      <p className="font-semibold text-white">{hover.title}</p>
      {hover.lines.map((line) => (
        <p key={line} className="text-slate-300">
          {line}
        </p>
      ))}
    </div>
  );
}

/** One bar per experiment: every email, coloured by what happened to it. */
function OutcomeBars({ experiments, onHover }: { experiments: Experiment[]; onHover: (hover: Hover | null) => void }) {
  return (
    <div className="space-y-5">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300" aria-label="Legend">
        {SEGMENTS.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      {experiments.map((e) => {
        const groups = SEGMENTS.map((s) => ({ ...s, results: e.results.filter((r) => segmentOf(r) === s.id) })).filter((g) => g.results.length > 0);
        const wrong = groups.find((g) => g.id === 'sentWrong')?.results.length ?? 0;
        return (
          <div key={e.name} className="grid grid-cols-[230px_1fr_120px] items-center gap-4">
            <div>
              <p className="text-[15px] font-semibold text-white">{nameOf(e)}</p>
              <p className="text-xs text-slate-400">{describe(e)}</p>
            </div>
            <div className="flex h-9 gap-[2px]" role="img" aria-label={`${nameOf(e)}: ${groups.map((g) => `${g.results.length} ${g.label.toLowerCase()}`).join(', ')}`}>
              {groups.map((g, i) => (
                <div
                  key={g.id}
                  className={cn('flex items-center justify-center text-sm font-semibold tabular-nums', i === 0 && 'rounded-l-[4px]', i === groups.length - 1 && 'rounded-r-[4px]')}
                  style={{ width: `${(g.results.length / e.results.length) * 100}%`, background: g.color, color: g.ink }}
                  onMouseMove={(event) =>
                    onHover({
                      x: event.clientX,
                      y: event.clientY,
                      title: `${g.label}: ${g.results.length} of ${e.results.length}`,
                      lines: [g.results.map((r) => r.emailId).join(', ')],
                    })
                  }
                  onMouseLeave={() => onHover(null)}
                >
                  {g.results.length}
                </div>
              ))}
            </div>
            <p className={cn('text-right text-sm', wrong ? 'text-rose-200' : 'text-emerald-200')}>{wrong} wrong sent</p>
          </div>
        );
      })}
    </div>
  );
}

/** A single-measure bar list: one row per item, labelled with its value. */
function BarList({ rows, max, format }: { rows: { label: string; value: number | null; note?: string }[]; max: number; format: (v: number) => string }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[150px_1fr_64px] items-center gap-3">
          <span className="truncate text-sm text-slate-300" title={row.note}>
            {row.label}
          </span>
          <div className="h-6 rounded-[4px] bg-white/[0.04]">
            {row.value !== null ? <div className="h-full rounded-[4px] bg-[#3987e5]" style={{ width: `${Math.max(1, (row.value / max) * 100)}%` }} /> : null}
          </div>
          <span className="text-right text-sm tabular-nums text-slate-200">{row.value === null ? '–' : format(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'bad' | 'good' | 'plain' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
      <p className="mb-2 text-sm text-slate-400">{label}</p>
      <p className={cn('text-5xl font-semibold tabular-nums', tone === 'bad' ? 'text-rose-300' : tone === 'good' ? 'text-emerald-300' : 'text-white')}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{sub}</p>
    </div>
  );
}

function ResultTable({ experiment }: { experiment: Experiment }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr className="border-b border-white/10">
          <th className="py-2 pr-3 font-medium">Email</th>
          <th className="py-2 pr-3 font-medium">Outcome</th>
          <th className="py-2 pr-3 font-medium">Reply graded</th>
          <th className="py-2 font-medium">Why</th>
        </tr>
      </thead>
      <tbody>
        {experiment.results.map((r) => {
          const segment = SEGMENTS.find((s) => s.id === segmentOf(r))!;
          return (
            <Fragment key={r.emailId}>
              <tr onClick={() => setOpen(open === r.emailId ? null : r.emailId)} className="cursor-pointer border-b border-white/5 align-top hover:bg-white/[0.03]">
                <td className="py-2.5 pr-3 font-mono text-[13px] text-slate-200">{r.emailId}</td>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: segment.color }} />
                    {r.mode === 'single' ? 'Sent' : OUTCOME_LABEL[r.outcome]}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  {r.replyCorrect === null ? (
                    <span className="text-slate-500">–</span>
                  ) : r.replyCorrect ? (
                    <span className="flex items-center gap-1.5 text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Right
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5" /> Wrong
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-slate-400">
                  {r.expectedRoute === 'escalated' ? (
                    <span className="flex items-center gap-1.5">
                      <Siren className="h-3.5 w-3.5" /> Outage: should go to on-call
                    </span>
                  ) : (
                    r.gradeReason
                  )}
                </td>
              </tr>
              {open === r.emailId && r.reply ? (
                <tr className="border-b border-white/5">
                  <td colSpan={4} className="pb-3">
                    <p className="whitespace-pre-wrap rounded-xl bg-white/[0.04] p-3 text-[14px] leading-6 text-slate-200">{r.reply}</p>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export function ResultsView() {
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [error, setError] = useState('');
  const [hover, setHover] = useState<Hover | null>(null);
  const [tableFor, setTableFor] = useState('workflow');

  useEffect(() => {
    fetchExperiments()
      .then(({ experiments: list }) => setExperiments(list))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Results could not be loaded.'));
  }, []);

  const sorted = useMemo(() => {
    const rank = (e: Experiment) => (ORDER.includes(e.name) ? ORDER.indexOf(e.name) : ORDER.length);
    return [...(experiments ?? [])].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [experiments]);

  if (error) return <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>;
  if (!experiments) return <p className="text-sm text-slate-400">Loading results…</p>;
  if (sorted.length === 0)
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <p className="mb-2 text-lg font-semibold text-white">No experiment results yet</p>
        <p>
          Run <code className="rounded bg-white/10 px-1.5 py-0.5">npm run experiment -- workflow</code> and{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5">npm run experiment -- single --mode single</code>, then reload this page.
        </p>
      </div>
    );

  const single = sorted.find((e) => e.name === 'single');
  const main = sorted.find((e) => e.name === 'workflow') ?? sorted.find((e) => e.mode === 'workflow');
  const outages = (e: Experiment) => e.results.filter((r) => r.expectedRoute === 'escalated');
  const table = sorted.find((e) => e.name === tableFor) ?? sorted[0];
  const withJson = sorted.filter((e) => e.summary.jsonFirstTry !== null);

  return (
    <div className="space-y-4">
      <Tooltip hover={hover} />
      <div className="grid gap-4 md:grid-cols-3">
        {single ? <Stat label="Single prompt: wrong replies sent" value={`${single.summary.sentWrong} / ${single.summary.emails}`} sub="Every reply goes straight to the customer." tone="bad" /> : null}
        {main ? (
          <Stat
            label={`${nameOf(main)}: wrong replies sent`}
            value={`${main.summary.sentWrong} / ${main.summary.emails}`}
            sub={`${main.summary.caught} wrong drafts stopped for review · ${main.summary.reviewedButCorrect} right drafts reviewed anyway`}
            tone={main.summary.sentWrong === 0 ? 'good' : 'plain'}
          />
        ) : null}
        {main ? (
          <Stat
            label="Outages sent to on-call"
            value={`${outages(main).filter((r) => r.outcome === 'escalated').length} / ${outages(main).length}`}
            sub={single ? `The single prompt answered ${outages(single).filter((r) => r.outcome !== 'escalated').length} of ${outages(single).length} outages itself.` : 'High-urgency outages skip the draft.'}
            tone="plain"
          />
        ) : null}
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
        <h2 className="mb-1 text-lg font-semibold text-white">What happened to each of the {sorted[0].summary.emails} emails</h2>
        <p className="mb-5 text-sm text-slate-400">Replies graded the Episode 3 way: required facts checked in code, a rubric judged by {short(sorted[0].settings.graderModel)}.</p>
        <OutcomeBars experiments={sorted} onHover={setHover} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Seconds per email (median)</h2>
          <p className="mb-5 text-sm text-slate-400">The price of the extra steps, on an 8 GB laptop.</p>
          <BarList rows={sorted.map((e) => ({ label: nameOf(e), value: e.summary.medianSeconds }))} max={Math.max(...sorted.map((e) => e.summary.medianSeconds ?? 0), 1)} format={(v) => `${v.toFixed(1)} s`} />
          {main ? (
            <>
              <p className="mb-3 mt-6 text-sm text-slate-400">{nameOf(main)}, by step</p>
              <BarList
                rows={Object.entries(main.summary.stepMedians)
                  .filter(([, v]) => v !== null && v >= 0.05)
                  .map(([step, v]) => ({ label: step, value: v }))}
                max={Math.max(...Object.values(main.summary.stepMedians).map((v) => v ?? 0), 1)}
                format={(v) => `${v.toFixed(1)} s`}
              />
            </>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Valid JSON on the first try</h2>
          <p className="mb-5 text-sm text-slate-400">The Understand step must return fields the workflow can branch on.</p>
          {withJson.length === 0 ? <p className="text-sm text-slate-400">Appears after a workflow experiment.</p> : null}
          <BarList rows={withJson.map((e) => ({ label: nameOf(e), value: e.summary.jsonFirstTry }))} max={1} format={(v) => pct(v)} />
          <div className="mt-5 space-y-1.5 text-sm text-slate-300">
            {withJson.map((e) => (
              <p key={e.name}>
                <span className="text-slate-400">{nameOf(e)}:</span> valid after retries {pct(e.summary.jsonAfterRetry)} · routed right (outage or not) {e.summary.escalationCorrect}/{e.summary.emails}
              </p>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Every email, every grade</h2>
          <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/60 p-1">
            {sorted.map((e) => (
              <button
                key={e.name}
                type="button"
                onClick={() => setTableFor(e.name)}
                className={cn('rounded-lg px-3 py-1.5 text-sm', table.name === e.name ? 'bg-sky-400/20 text-sky-100' : 'text-slate-400 hover:text-slate-200')}
              >
                {nameOf(e)}
              </button>
            ))}
          </div>
        </div>
        <ResultTable experiment={table} />
      </section>
    </div>
  );
}
