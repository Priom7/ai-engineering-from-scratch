import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Database,
  FileText,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';

import {
  fetchDocuments,
  fetchHealth,
  queryKnowledgeBase,
  resetKnowledgeBase,
  uploadDocument,
  type Citation,
  type DocumentSummary,
  type HealthResponse,
  type QueryResponse,
} from './api';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Textarea } from './components/ui/textarea';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCharacters(count: number) {
  return `${count.toLocaleString()} chars`;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [question, setQuestion] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [healthResponse, documentsResponse] = await Promise.all([
          fetchHealth(),
          fetchDocuments(),
        ]);

        setHealth(healthResponse);
        setDocuments(documentsResponse.documents);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load app state.');
      }
    }

    void load();
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file || uploading) {
      return;
    }

    setUploading(true);
    setError('');

    try {
      await uploadDocument(file);
      const [healthResponse, documentsResponse] = await Promise.all([
        fetchHealth(),
        fetchDocuments(),
      ]);
      setHealth(healthResponse);
      setDocuments(documentsResponse.documents);
      form.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedQuestion = question.trim();

    if (!cleanedQuestion || querying) {
      return;
    }

    setQuerying(true);
    setError('');

    try {
      const result = await queryKnowledgeBase(cleanedQuestion);
      setQueryResult(result);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Query failed.');
    } finally {
      setQuerying(false);
    }
  }

  const topCitation = useMemo<Citation | null>(() => queryResult?.citations[0] ?? null, [queryResult]);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid bg-[length:34px_34px] opacity-20" />
      <div className="container py-8 md:py-10">
        <header className="mb-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="overflow-hidden border-sky-400/10 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-cyan-950/70">
            <CardContent className="p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Project 002
                </Badge>
                <Badge variant={health?.ok ? 'success' : 'warning'} className="gap-1.5 px-3 py-1">
                  {health?.ok ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {health?.ok ? 'RAG runtime ready' : 'Checking local stack'}
                </Badge>
              </div>

              <h1 className="mb-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
                RAG Workspace Assistant
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                Upload local notes and documents, embed them with Ollama, retrieve the
                best chunks, and generate grounded answers with citations.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <Database className="h-4 w-4 text-sky-300" />
                    Documents
                  </div>
                  <p className="text-2xl font-semibold text-white">{health?.documentCount ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <FileText className="h-4 w-4 text-sky-300" />
                    Chunks
                  </div>
                  <p className="text-2xl font-semibold text-white">{health?.chunkCount ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <Bot className="h-4 w-4 text-sky-300" />
                    Models
                  </div>
                  <p className="text-2xl font-semibold text-white">{health?.modelCount ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Local runtime</CardTitle>
              <CardDescription>Current Ollama and indexing configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-1 text-sm font-medium text-slate-100">Chat model</p>
                <p className="text-sm text-slate-400">{health?.runtime.chatModel ?? 'Loading...'}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-1 text-sm font-medium text-slate-100">Embedding model</p>
                <p className="text-sm text-slate-400">{health?.runtime.embedModel ?? 'Loading...'}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-1 text-sm font-medium text-slate-100">Best current use</p>
                <p className="text-sm leading-6 text-slate-400">
                  Beginner-to-intermediate RAG practice with local documents, no database, and a
                  transparent retrieval flow.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  setError('');
                  await resetKnowledgeBase();
                  const [healthResponse, documentsResponse] = await Promise.all([
                    fetchHealth(),
                    fetchDocuments(),
                  ]);
                  setHealth(healthResponse);
                  setDocuments(documentsResponse.documents);
                  setQueryResult(null);
                }}
                type="button"
              >
                Reset local knowledge base
              </Button>
            </CardContent>
          </Card>
        </header>

        <main className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Upload source documents</CardTitle>
                <CardDescription>
                  This beginner version supports `.txt` and `.md` files. Uploading embeds each
                  chunk locally with Ollama.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleUpload}>
                  <input
                    accept=".txt,.md"
                    className="block w-full rounded-xl border border-dashed border-border bg-background/50 p-4 text-sm text-slate-300"
                    name="file"
                    type="file"
                  />
                  <Button disabled={uploading} type="submit">
                    {uploading ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Ingesting...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload and index
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Indexed documents</CardTitle>
                <CardDescription>
                  Each upload is split into chunks and embedded into the local JSON index.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {documents.length > 0 ? (
                  documents.map((document) => (
                    <div
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                      key={document.id}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{document.originalName}</p>
                        <Badge variant="outline">{document.chunkCount} chunks</Badge>
                      </div>
                      <p className="text-sm text-slate-400">
                        {formatCharacters(document.contentLength)} • {formatDate(document.uploadedAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                    No documents yet. Upload a note or document to start building the retrieval
                    index.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Ask the knowledge base</CardTitle>
              <CardDescription>
                The backend embeds your question, finds the most similar chunks, and asks the chat
                model to answer only from that context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form className="space-y-4" onSubmit={handleQuery}>
                <Textarea
                  rows={4}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about your uploaded documents..."
                />
                <Button disabled={querying || documents.length === 0} size="lg" type="submit">
                  {querying ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Searching and answering...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Run RAG query
                    </>
                  )}
                </Button>
              </form>

              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                  <p className="mb-1 text-sm font-medium text-rose-100">Problem</p>
                  <p className="text-sm leading-6 text-slate-200">{error}</p>
                </div>
              ) : null}

              {queryResult ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-sky-400/10 bg-sky-400/10 p-5">
                    <p className="mb-2 text-sm font-medium text-sky-100">Answer</p>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
                      {queryResult.answer}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.72fr_0.28fr]">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="mb-3 text-sm font-medium text-slate-100">Citations</p>
                      <div className="space-y-3">
                        {queryResult.citations.map((citation, index) => (
                          <div
                            className="rounded-2xl border border-white/8 bg-background/40 p-4"
                            key={`${citation.documentName}-${index}`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="font-medium text-white">{citation.documentName}</p>
                              <Badge variant="secondary">score {citation.score}</Badge>
                            </div>
                            <p className="text-sm leading-6 text-slate-400">{citation.preview}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="mb-1 text-sm font-medium text-slate-100">Model</p>
                        <p className="text-sm text-slate-400">{queryResult.model}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="mb-1 text-sm font-medium text-slate-100">Prompt tokens</p>
                        <p className="text-sm text-slate-400">{queryResult.stats.promptTokens}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="mb-1 text-sm font-medium text-slate-100">Response tokens</p>
                        <p className="text-sm text-slate-400">{queryResult.stats.responseTokens}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="mb-1 text-sm font-medium text-slate-100">Best source</p>
                        <p className="text-sm text-slate-400">
                          {topCitation ? topCitation.documentName : 'No citation'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                  <Search className="mb-4 h-12 w-12 text-sky-300" />
                  <h3 className="mb-2 text-lg font-semibold text-white">Grounded answers appear here</h3>
                  <p className="max-w-md text-sm leading-6 text-slate-400">
                    Upload documents, ask a question, and inspect the citation list to see which
                    chunks were retrieved before the answer was generated.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

