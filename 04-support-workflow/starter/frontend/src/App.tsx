import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Inbox, LoaderCircle, Workflow as WorkflowIcon } from 'lucide-react';

import { fetchEmails, fetchHealth, fetchWorkflow, type Email, type Workflow } from './api';
import { cn } from './lib/utils';
import { InboxView } from './views/InboxView';
import { ResultsView } from './views/ResultsView';
import { WorkflowView } from './views/WorkflowView';

type View = 'workflow' | 'inbox' | 'results';
type Health = Awaited<ReturnType<typeof fetchHealth>>;

const TABS = [
  { id: 'workflow', label: 'Workflow', icon: WorkflowIcon },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'results', label: 'Results', icon: BarChart3 },
] as const;

// ?view=inbox&email=<id> opens a view directly.
const params = new URLSearchParams(window.location.search);
const initialView = (TABS.some((t) => t.id === params.get('view')) ? params.get('view') : 'workflow') as View;

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailId, setEmailId] = useState(params.get('email') ?? '');
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');

  const loadEmails = useCallback(async () => {
    const { emails: list } = await fetchEmails();
    setEmails(list);
    setEmailId((current) => (list.some((e) => e.id === current) ? current : (list.find((e) => !e.pasted)?.id ?? list[0]?.id ?? '')));
  }, []);

  useEffect(() => {
    Promise.all([fetchWorkflow().then(setWorkflow), loadEmails()]).catch((loadError) =>
      setError(loadError instanceof Error ? `${loadError.message} Start the backend with npm run dev.` : 'The backend is not reachable. Start it with npm run dev.'),
    );
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth({ ok: false, documents: 0, chunks: 0, models: [] }));
  }, [loadEmails]);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid bg-[length:34px_34px] opacity-20" />
      <div className="mx-auto max-w-[1400px] px-5 py-6">
        <nav className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-white">Fernhill Cloud · Support Desk</span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
                health === null ? 'bg-white/5 text-slate-400' : health.ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200',
              )}
            >
              {health === null ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <span className={cn('h-1.5 w-1.5 rounded-full', health.ok ? 'bg-emerald-300' : 'bg-rose-300')} />}
              {health === null ? 'Checking Ollama' : health.ok ? `Ollama ready · ${health.documents} help docs` : 'Ollama is not running. Start it with ollama serve.'}
            </span>
          </div>
          <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/60 p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn('inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium', view === id ? 'bg-sky-400/20 text-sky-100' : 'text-slate-400 hover:text-slate-200')}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {error ? <p className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

        {view === 'workflow' && workflow ? <WorkflowView workflow={workflow} emails={emails} emailId={emailId} onEmailChange={setEmailId} /> : null}
        {view === 'inbox' ? (
          <InboxView
            emails={emails}
            onEmailsChange={loadEmails}
            onOpen={(id) => {
              setEmailId(id);
              setView('workflow');
            }}
          />
        ) : null}
        {view === 'results' ? <ResultsView /> : null}
      </div>
    </div>
  );
}
