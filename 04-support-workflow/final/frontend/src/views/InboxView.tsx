import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, LoaderCircle, Play, Workflow as WorkflowIcon } from 'lucide-react';

import { addEmail, fetchRun, fetchRuns, followRun, OUTCOME_LABEL, startRun, type Email, type Outcome, type RunRecord, type RunSummary } from '../api';
import { cn } from '../lib/utils';

const CHIP: Record<Outcome | 'none', string> = {
  ready: 'bg-emerald-400/15 text-emerald-200',
  review: 'bg-amber-300/15 text-amber-200',
  escalated: 'bg-rose-400/15 text-rose-200',
  failed: 'bg-rose-400/15 text-rose-200',
  none: 'bg-white/5 text-slate-400',
};

function StatusChip({ outcome }: { outcome: Outcome | null }) {
  return <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', CHIP[outcome ?? 'none'])}>{outcome ? OUTCOME_LABEL[outcome] : 'Not run'}</span>;
}

function PasteForm({ onAdded }: { onAdded: (email: Email) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value;
    setSaving(true);
    setError('');
    try {
      onAdded(await addEmail({ from: field('from'), subject: field('subject'), body: field('body') }));
      form.reset();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'The email could not be added.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300/50';
  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-sky-300/20 bg-sky-400/5 p-3">
      <input name="from" placeholder="From, e.g. sam@example.com" className={input} />
      <input name="subject" placeholder="Subject" className={input} />
      <textarea name="body" required rows={5} placeholder="Paste the customer's email here" className={cn(input, 'resize-y leading-6')} />
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-60">
        {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Add to inbox
      </button>
    </form>
  );
}

function RunDetails({ run }: { run: RunRecord }) {
  const understand = run.context.understand as { intent: string; plan: string; urgency: string; question: string } | undefined;
  const check = run.context.check as { supported: boolean; reason: string; unsupportedClaims: string[] } | undefined;
  return (
    <div className="space-y-4">
      {understand ? (
        <div>
          <p className="mb-2 text-sm text-slate-400">Understood as</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {(['intent', 'plan', 'urgency'] as const).map((key) => (
              <span key={key} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-200">
                <span className="text-slate-400">{key} </span>
                {understand[key].replace('_', ' ')}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[15px] text-slate-300">“{understand.question}”</p>
        </div>
      ) : null}
      {run.reply ? (
        <div>
          <p className="mb-2 text-sm text-slate-400">Draft reply</p>
          <p className="whitespace-pre-wrap rounded-xl bg-white/[0.04] p-4 text-[15px] leading-7 text-slate-100">{run.reply}</p>
        </div>
      ) : null}
      {check ? (
        <div className={cn('rounded-xl border p-4', check.supported ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-300/20 bg-amber-300/5')}>
          <p className={cn('mb-1 flex items-center gap-2 font-semibold', check.supported ? 'text-emerald-200' : 'text-amber-200')}>
            {check.supported ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {check.supported ? 'Check passed: every claim is in the sources' : 'Check flagged this draft'}
          </p>
          <p className="text-sm leading-6 text-slate-300">{check.reason}</p>
          {check.unsupportedClaims.map((claim, i) => (
            <p key={i} className="mt-2 rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              “{claim}”
            </p>
          ))}
        </div>
      ) : null}
      {run.outcome === 'escalated' ? <p className="text-[15px] text-rose-100">Sent to the on-call team as an outage. No reply was drafted.</p> : null}
      {run.outcome === 'failed' ? <p className="text-[15px] text-rose-100">{String(run.context.error ?? 'The run failed.')}</p> : null}
    </div>
  );
}

export function InboxView({ emails, onEmailsChange, onOpen }: { emails: Email[]; onEmailsChange: () => Promise<void>; onOpen: (emailId: string) => void }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<RunRecord | null>(null);
  const [pasting, setPasting] = useState(false);
  const [progress, setProgress] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const stop = useRef<() => void>(() => undefined);

  const loadRuns = useCallback(async () => setRuns((await fetchRuns()).runs), []);
  useEffect(() => {
    loadRuns().catch(() => undefined);
    return () => stop.current();
  }, [loadRuns]);

  const selected = emails.find((e) => e.id === selectedId) ?? emails[0];
  // Runs come newest first, so the first one for an email is its latest.
  const latest = (id: string) => runs.find((r) => r.emailId === id && r.mode === 'workflow') ?? null;
  const latestId = selected ? latest(selected.id)?.id : undefined;

  useEffect(() => {
    setDetail(null);
    if (latestId) fetchRun(latestId).then(setDetail).catch(() => undefined);
  }, [latestId]);

  async function handleRun(email: Email) {
    setError('');
    setProgress([]);
    try {
      const { runId } = await startRun({ emailId: email.id, mode: 'workflow' });
      stop.current = followRun(runId, (event) => {
        if (event.type === 'step-end' && event.trace.type !== 'condition') setProgress((p) => [...(p ?? []), event.trace.title]);
        if (event.type === 'run-end') {
          setProgress(null);
          void loadRuns();
        }
      });
    } catch (runError) {
      setProgress(null);
      setError(runError instanceof Error ? runError.message : 'The run could not start.');
    }
  }

  const counts = emails.reduce<Record<string, number>>((acc, e) => {
    const outcome = latest(e.id)?.outcome ?? 'none';
    acc[outcome] = (acc[outcome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-4 lg:grid-cols-[440px_1fr]">
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Inbox</h2>
          <button
            type="button"
            onClick={() => setPasting((p) => !p)}
            className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/5"
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste an email
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-400">
          {emails.length} emails · {counts.ready ?? 0} ready · {counts.review ?? 0} for review · {counts.escalated ?? 0} escalated
        </p>
        {pasting ? (
          <div className="mb-3">
            <PasteForm
              onAdded={(email) => {
                setPasting(false);
                setSelectedId(email.id);
                void onEmailsChange();
              }}
            />
          </div>
        ) : null}
        <ul className="max-h-[720px] space-y-1 overflow-y-auto pr-1">
          {emails.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={cn('w-full rounded-xl px-3 py-2.5 text-left', selected?.id === e.id ? 'bg-sky-400/15' : 'hover:bg-white/[0.04]')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-medium text-slate-100">{e.subject}</span>
                  <StatusChip outcome={latest(e.id)?.outcome ?? null} />
                </div>
                <p className="truncate text-sm text-slate-400">
                  {e.from} · {e.body}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected ? (
        <section className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-400">From {selected.from}</p>
              <h2 className="text-xl font-semibold text-white">{selected.subject}</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpen(selected.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-slate-200 hover:bg-white/5"
              >
                <WorkflowIcon className="h-4 w-4" />
                Watch it run
              </button>
              <button
                type="button"
                onClick={() => handleRun(selected)}
                disabled={progress !== null}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {progress !== null ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run workflow
              </button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-300">{selected.body}</p>
          {progress !== null ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-cyan-200">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {progress.length ? `Done: ${progress.join(' → ')}` : 'Starting…'}
            </p>
          ) : null}
          {error ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          <div className="border-t border-white/10 pt-5">
            {detail ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <StatusChip outcome={detail.outcome} />
                  <span className="text-sm text-slate-400">
                    Latest run, {(detail.durationMs / 1000).toFixed(1)} s, {new Date(detail.startedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <RunDetails run={detail} />
              </>
            ) : (
              <p className="text-sm text-slate-400">This email hasn't been through the workflow yet. Run it to draft a reply and check it.</p>
            )}
          </div>
        </section>
      ) : (
        <p className="text-sm text-slate-400">The inbox is empty. Paste an email to get started.</p>
      )}
    </div>
  );
}
