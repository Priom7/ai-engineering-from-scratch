import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, FileSearch, Gauge, MessageSquareWarning, XCircle } from 'lucide-react';

import { Badge } from './components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { cn } from './lib/utils';
import {
  changeOf,
  fetchQuestions,
  fetchRun,
  fetchRuns,
  passRate,
  pct,
  points,
  tally,
  type EvalAttempt,
  type EvalQuestion,
  type EvalRun,
  type QuestionResult,
  type RunListing,
} from './evals';

// The Evals view: every saved eval run, its scores, a question-by-question grid
// of attempts, a comparison with another run, and each answer with its grade.

type Filter = 'all' | 'failing' | 'changed';

const METRICS = [
  { key: 'retrievalHitRate', label: 'Retrieval', hint: 'found the right paragraph', icon: FileSearch },
  { key: 'answerPassRate', label: 'Answers', hint: 'correct', icon: CheckCircle2 },
  { key: 'honestyPassRate', label: 'Honesty', hint: "said it isn't in the docs", icon: MessageSquareWarning },
  { key: 'overallPassRate', label: 'Overall', hint: 'all attempts', icon: Gauge },
] as const;

/** A metric's value, or null when the run has nothing to measure it on (e.g. retrieval in a run of only unanswerable questions). */
function metricValue(run: EvalRun, key: (typeof METRICS)[number]['key']) {
  if (key === 'retrievalHitRate' && !run.summary.questions.some((q) => q.kind === 'answerable')) return null;
  return run.summary[key];
}

function Dots({ attempts, size = 14 }: { attempts: EvalAttempt[]; size?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {attempts.map((a) => (
        <span
          key={a.attempt}
          title={`Attempt ${a.attempt}: ${a.passed ? 'pass' : 'fail'}`}
          className={cn('inline-block rounded-full border-2', a.passed ? 'border-emerald-400 bg-emerald-400' : 'border-rose-400/80 bg-transparent')}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

function Delta({ before, after }: { before: number | null; after: number | null }) {
  const change = points(before, after);
  if (!change) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold',
        change.delta > 0 && 'bg-emerald-400/15 text-emerald-300',
        change.delta < 0 && 'bg-rose-400/15 text-rose-300',
        change.delta === 0 && 'bg-white/5 text-slate-300',
      )}
    >
      {change.delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : change.delta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
      {change.label}
    </span>
  );
}

/** Horizontal bars, one group per metric: the selected run and, if any, the run it's compared with. */
function ScoreChart({ run, other, runName, otherName }: { run: EvalRun; other: EvalRun | null; runName: string; otherName: string }) {
  const rows = METRICS.filter((m) => metricValue(run, m.key) !== null || (other && metricValue(other, m.key) !== null));
  const barH = 22;
  const groupH = other ? barH * 2 + 26 : barH + 26;
  const labelW = 120;
  const width = 640;
  const barMax = width - labelW - 70;
  return (
    <svg viewBox={`0 0 ${width} ${rows.length * groupH}`} className="w-full" role="img" aria-label="Scores by metric">
      {rows.map((m, i) => {
        const y = i * groupH;
        const bars = [
          { value: metricValue(run, m.key), color: '#22d3ee', name: runName },
          ...(other ? [{ value: metricValue(other, m.key), color: '#a78bfa', name: otherName }] : []),
        ];
        return (
          <g key={m.key} transform={`translate(0, ${y})`}>
            <text x={0} y={barH - 5} className="fill-slate-300" fontSize={15}>
              {m.label}
            </text>
            {bars.map((bar, j) => (
              <g key={bar.name + j} transform={`translate(${labelW}, ${j * (barH + 4)})`}>
                <rect x={0} y={0} width={barMax} height={barH} rx={6} fill="rgba(148,163,184,0.10)" />
                <rect x={0} y={0} width={Math.max(4, (bar.value ?? 0) * barMax)} height={barH} rx={6} fill={bar.color} />
                <text x={barMax + 10} y={barH - 5} className="fill-white" fontSize={15} fontWeight={600}>
                  {pct(bar.value)}
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function expectation(q: EvalQuestion) {
  if (q.grade.type === 'refuse') return "Not in the documents: the answer should say so, without inventing anything.";
  if (q.grade.type === 'facts') return `Must say: ${q.grade.mustSay.map((m) => m.split('|')[0]).join(', ')}`;
  return q.grade.reference;
}

function AttemptList({ title, attempts, accent }: { title: string; attempts: EvalAttempt[]; accent: string }) {
  return (
    <div className="space-y-3">
      <p className={cn('text-sm font-semibold', accent)}>{title}</p>
      {attempts.map((a) => (
        <div key={a.attempt} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">
              Attempt {a.attempt} · seed {a.seed} · {(a.durationMs / 1000).toFixed(1)} s
            </span>
            <Badge variant={a.passed ? 'success' : 'warning'} className={cn(!a.passed && 'border-rose-500/20 bg-rose-500/15 text-rose-200')}>
              {a.passed ? 'Pass' : 'Fail'}
            </Badge>
          </div>
          <p className="text-[15px] leading-6 text-slate-100">{a.answer || a.error}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            <span className="text-slate-500">Grader: </span>
            {a.reason}
          </p>
        </div>
      ))}
    </div>
  );
}

export function EvalsView() {
  const [runs, setRuns] = useState<RunListing[]>([]);
  const [questions, setQuestions] = useState<EvalQuestion[]>([]);
  const [runName, setRunName] = useState('');
  const [compareName, setCompareName] = useState('');
  const [run, setRun] = useState<EvalRun | null>(null);
  const [other, setOther] = useState<EvalRun | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchRuns(), fetchQuestions()])
      .then(([runList, dataset]) => {
        setRuns(runList.runs);
        setQuestions(dataset.questions);
        setRunName(runList.runs.find((r) => r.name === 'baseline')?.name ?? runList.runs[0]?.name ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load eval runs.'));
  }, []);

  useEffect(() => {
    if (!runName) return;
    fetchRun(runName).then(setRun).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the run.'));
  }, [runName]);

  useEffect(() => {
    if (!compareName) {
      setOther(null);
      return;
    }
    fetchRun(compareName).then(setOther).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the run.'));
  }, [compareName]);

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const otherRows = useMemo(() => new Map((other?.summary.questions ?? []).map((q) => [q.id, q])), [other]);

  const rows = useMemo(() => {
    const all = run?.summary.questions ?? [];
    if (filter === 'failing') return all.filter((q) => q.passes < q.attempts);
    if (filter === 'changed') return all.filter((q) => (changeOf(q, otherRows.get(q.id)) ?? 'unchanged') !== 'unchanged');
    return all;
  }, [run, filter, otherRows]);

  const changes = useMemo(() => {
    if (!run || !other) return null;
    const list = run.summary.questions
      .map((q) => ({ row: q, change: changeOf(q, otherRows.get(q.id)) }))
      .filter((c): c is { row: QuestionResult; change: 'improved' | 'regressed' | 'unchanged' } => c.change !== null);
    return {
      improved: list.filter((c) => c.change === 'improved'),
      regressed: list.filter((c) => c.change === 'regressed'),
      unchanged: list.filter((c) => c.change === 'unchanged').length,
    };
  }, [run, other, otherRows]);

  const attemptsOf = (r: EvalRun | null, id: string) => (r?.attempts ?? []).filter((a) => a.questionId === id);
  const selectedQuestion = selected ? byId.get(selected) : undefined;

  if (error) {
    return (
      <Card className="border-rose-500/30">
        <CardContent className="p-6 text-rose-200">{error} Run `npm run eval -- baseline` first, then reload.</CardContent>
      </Card>
    );
  }

  if (!run) {
    return <p className="text-slate-400">Loading eval runs…</p>;
  }

  const s = run.settings;
  // How many times longer (or shorter) an answer takes in the compared run.
  const ratio = other?.summary.medianSeconds && run.summary.medianSeconds ? other.summary.medianSeconds / run.summary.medianSeconds : null;

  return (
    <div className="space-y-6">
      <Card className="border-white/10">
        <CardContent className="flex flex-wrap items-end justify-between gap-6 p-6">
          <div>
            <p className="mb-1 text-sm text-slate-400">Evaluation run</p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">{runName}</h2>
            <p className="mt-2 text-sm text-slate-400">
              config {run.config} · {s.chatModel} · chunks {s.chunkSize}/{s.chunkOverlap} · top {s.topK} · {s.repeats} attempts per question · judge {s.judgeModel}
              {s.documents ? ` · ${s.documents.length} documents` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="text-sm text-slate-400">
              Run
              <select
                className="mt-1 block w-56 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-base text-white"
                value={runName}
                onChange={(e) => {
                  setRunName(e.target.value);
                  setSelected(null);
                }}
              >
                {runs.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Compare with
              <select
                className="mt-1 block w-56 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-base text-white"
                value={compareName}
                onChange={(e) => setCompareName(e.target.value)}
              >
                <option value="">Nothing</option>
                {runs
                  .filter((r) => r.name !== runName)
                  .map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {METRICS.filter((m) => metricValue(run, m.key) !== null || (other && metricValue(other, m.key) !== null)).map((m) => {
          const Icon = m.icon;
          const kind = m.key === 'answerPassRate' ? 'answerable' : m.key === 'honestyPassRate' ? 'unanswerable' : 'all';
          const count =
            m.key === 'retrievalHitRate'
              ? `${run.summary.questions.filter((q) => q.hit).length}/${run.summary.questions.filter((q) => q.kind === 'answerable').length} questions`
              : `${tally(run, kind)} attempts`;
          return (
            <Card key={m.key} className="border-white/10">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                  <Icon className="h-4 w-4 text-sky-300" />
                  {m.label}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tracking-tight text-white">{pct(metricValue(run, m.key))}</span>
                  {other ? <Delta before={metricValue(run, m.key)} after={metricValue(other, m.key)} /> : null}
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {m.hint} · {count}
                </p>
                {other ? (
                  <p className="mt-1 text-sm text-violet-300">
                    {compareName}: {pct(metricValue(other, m.key))}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        <Card className="border-white/10">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
              <Clock3 className="h-4 w-4 text-sky-300" />
              Speed
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-tight text-white">{run.summary.medianSeconds?.toFixed(1)} s</span>
              {other && ratio !== null ? (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-sm font-semibold',
                    ratio >= 1.1 && 'bg-rose-400/15 text-rose-300',
                    ratio <= 0.9 && 'bg-emerald-400/15 text-emerald-300',
                    ratio > 0.9 && ratio < 1.1 && 'bg-white/5 text-slate-300',
                  )}
                >
                  {ratio.toFixed(1)}× time
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-400">median per answer</p>
            {other ? <p className="mt-1 text-sm text-violet-300">{compareName}: {other.summary.medianSeconds?.toFixed(1)} s</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Scores</CardTitle>
            <CardDescription>
              <span className="text-cyan-300">■ {runName}</span>
              {other ? <span className="ml-4 text-violet-300">■ {compareName}</span> : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreChart run={run} other={other} runName={runName} otherName={compareName} />
          </CardContent>
        </Card>
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-white">{changes ? 'What changed' : 'Where it fails'}</CardTitle>
            <CardDescription>
              {changes
                ? `${changes.improved.length} improved · ${changes.regressed.length} regressed · ${changes.unchanged} unchanged`
                : 'Questions that failed at least one attempt'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(changes ? [...changes.improved, ...changes.regressed].map((c) => c.row) : run.summary.questions.filter((q) => q.passes < q.attempts)).map((q) => {
              const change = changes ? changeOf(q, otherRows.get(q.id)) : null;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelected(q.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left hover:bg-white/[0.06]"
                >
                  <span className="text-[15px] text-slate-100">{q.id}</span>
                  <span className="flex items-center gap-2 text-sm text-slate-300">
                    {pct(passRate(q))}
                    {change ? (
                      <>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                        <span className={change === 'improved' ? 'text-emerald-300' : 'text-rose-300'}>{pct(passRate(otherRows.get(q.id)))}</span>
                      </>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-white/10">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-white">Questions</CardTitle>
              <CardDescription>One dot per attempt. Click a question to read its answers.</CardDescription>
            </div>
            <div className="flex gap-1 rounded-xl border border-white/10 p-1">
              {(['all', 'failing', ...(other ? ['changed'] : [])] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn('rounded-lg px-3 py-1.5 text-sm capitalize', filter === f ? 'bg-sky-400/20 text-sky-200' : 'text-slate-400 hover:text-slate-200')}
                >
                  {f}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {rows.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelected(q.id)}
                className={cn(
                  'grid w-full grid-cols-[minmax(170px,1fr)_auto_auto] items-center gap-4 rounded-xl px-3 py-2 text-left hover:bg-white/[0.05]',
                  selected === q.id && 'bg-sky-400/10 ring-1 ring-sky-400/40',
                )}
              >
                <span className="truncate text-[15px] text-slate-100">
                  {q.id}
                  {q.kind === 'unanswerable' ? <span className="ml-2 text-xs text-slate-500">not in docs</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  <Dots attempts={attemptsOf(run, q.id)} size={q.attempts > 5 ? 11 : 14} />
                  {other ? (
                    <>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                      <Dots attempts={attemptsOf(other, q.id)} size={q.attempts > 5 ? 11 : 14} />
                    </>
                  ) : null}
                </span>
                <span className="w-12 text-right text-sm tabular-nums text-slate-400">
                  {q.passes}/{q.attempts}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-white">{selectedQuestion ? selectedQuestion.question : 'Pick a question'}</CardTitle>
            <CardDescription>
              {selectedQuestion ? (
                <>
                  {selectedQuestion.source ? `Source: ${selectedQuestion.source} · ` : ''}
                  {expectation(selectedQuestion)}
                </>
              ) : (
                'Every answer from this run, with the grader’s reason.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedQuestion ? (
              <div className={cn('grid gap-4', other && 'lg:grid-cols-2')}>
                <AttemptList title={runName} attempts={attemptsOf(run, selectedQuestion.id)} accent="text-cyan-300" />
                {other ? <AttemptList title={compareName} attempts={attemptsOf(other, selectedQuestion.id)} accent="text-violet-300" /> : null}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 p-6 text-slate-400">
                <XCircle className="h-5 w-5 text-rose-300" />
                Start with a question that has an empty dot.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
