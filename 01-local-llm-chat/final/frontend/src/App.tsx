import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  HardDriveDownload,
  LoaderCircle,
  MessageSquareText,
  Orbit,
  RefreshCw,
  SendHorizonal,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { fetchConfig, fetchHealth, fetchModels, sendChat } from './api';
import type { ChatMessage, ModelSummary } from './types';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card';
import { Input } from './components/ui/input';
import { Select } from './components/ui/select';
import { Textarea } from './components/ui/textarea';

const starterSystemPrompt =
  'You are a helpful local assistant. Keep answers simple and practical for a beginner.';

function formatBytes(bytes?: number): string {
  if (!bytes) {
    return 'Unknown size';
  }

  const sizes = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < sizes.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(1)} ${sizes[index]}`;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(starterSystemPrompt);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [modelName, setModelName] = useState('');
  const [appName, setAppName] = useState('Ollama Chat 001');
  const [statusText, setStatusText] = useState('Checking backend and Ollama...');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statsText, setStatsText] = useState('');
  const [modelCount, setModelCount] = useState(0);
  const [ollamaReady, setOllamaReady] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [config, health, modelsResponse] = await Promise.all([
          fetchConfig(),
          fetchHealth(),
          fetchModels(),
        ]);

        setAppName(config.appName);
        setModelName(config.defaultModel);
        setModels(modelsResponse.models);
        setModelCount(health.modelCount);
        setOllamaReady(health.ollamaReachable);
        setStatusText(
          health.ollamaReachable
            ? `Ollama is connected. ${health.modelCount} model(s) available.`
            : 'Ollama is not reachable.',
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load the app configuration.',
        );
        setOllamaReady(false);
        setStatusText('Backend or Ollama is not ready yet.');
      }
    }

    void loadInitialData();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedPrompt = prompt.trim();

    if (!cleanedPrompt || loading) {
      return;
    }

    const nextMessages = [...messages, { role: 'user' as const, content: cleanedPrompt }];

    setMessages(nextMessages);
    setPrompt('');
    setLoading(true);
    setError('');

    try {
      const result = await sendChat({
        model: modelName,
        systemPrompt,
        messages: nextMessages,
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', content: result.reply },
      ]);

      setStatsText(
        `Model: ${result.model} | Prompt tokens: ${result.stats.promptTokens} | Response tokens: ${result.stats.responseTokens} | Duration: ${
          result.stats.totalDurationMs ?? 'n/a'
        } ms`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedModel = useMemo(
    () => models.find((model) => model.name === modelName),
    [modelName, models],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-hero-grid bg-[length:34px_34px] opacity-20" />
      <div className="container py-8 md:py-10">
        <header className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-sky-400/10 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-cyan-950/70">
            <CardContent className="p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Beginner Project 001
                </Badge>
                <Badge variant={ollamaReady ? 'success' : 'warning'} className="gap-1.5 rounded-full px-3 py-1">
                  {ollamaReady ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {ollamaReady ? 'Local Ollama ready' : 'Waiting for Ollama'}
                </Badge>
              </div>

              <div className="max-w-3xl">
                <h1 className="mb-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  {appName}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  A polished starter for local AI chat. The browser stays clean, the
                  Node backend manages the API boundary, and Ollama runs the model on
                  your machine.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <Orbit className="h-4 w-4 text-sky-300" />
                    Runtime
                  </div>
                  <p className="text-2xl font-semibold text-white">Local-first</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <Database className="h-4 w-4 text-sky-300" />
                    Models
                  </div>
                  <p className="text-2xl font-semibold text-white">{modelCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <Server className="h-4 w-4 text-sky-300" />
                    Stack
                  </div>
                  <p className="text-2xl font-semibold text-white">React + Node</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <BrainCircuit className="h-5 w-5 text-sky-300" />
                Session control
              </CardTitle>
              <CardDescription>{statusText}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="model-select">
                  Active model
                </label>
                <Select
                  id="model-select"
                  value={modelName}
                  onChange={(event) => setModelName(event.target.value)}
                >
                  {models.length > 0 ? (
                    models.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))
                  ) : (
                    <option value={modelName || ''}>{modelName || 'No model loaded'}</option>
                  )}
                </Select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-100">
                  <HardDriveDownload className="h-4 w-4 text-sky-300" />
                  Selected model details
                </div>
                <p className="text-sm text-slate-300">
                  {selectedModel
                    ? `${selectedModel.name} • ${formatBytes(selectedModel.size)}`
                    : 'Pick a model from the list or type one in the backend config.'}
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  'Frontend sends chat to the backend',
                  'Backend calls Ollama locally',
                  'Reply comes back with generation stats',
                ].map((step) => (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
                    key={step}
                  >
                    <ChevronRight className="h-4 w-4 text-sky-300" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </header>

        <main className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <MessageSquareText className="h-5 w-5 text-sky-300" />
                  Conversation
                </CardTitle>
                <CardDescription>
                  Send a prompt to your local model and inspect the response flow.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setStatsText('');
                  setError('');
                }}
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                Clear
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="min-h-[360px] space-y-4 rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                {!hasMessages ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                    <Bot className="mb-4 h-12 w-12 text-sky-300" />
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      Start a local conversation
                    </h3>
                    <p className="max-w-md text-sm leading-6 text-slate-400">
                      Try asking for a simple explanation, a short summary, or a code
                      example. This starter is designed to make the request path easy
                      to understand.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <article
                      className={`rounded-2xl border p-4 ${
                        message.role === 'user'
                          ? 'ml-auto max-w-[88%] border-sky-400/20 bg-sky-400/10'
                          : 'max-w-[92%] border-amber-300/15 bg-amber-300/10'
                      }`}
                      key={`${message.role}-${index}`}
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                        {message.role === 'user' ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
                        ) : (
                          <Bot className="h-3.5 w-3.5 text-amber-300" />
                        )}
                        {message.role}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
                        {message.content}
                      </p>
                    </article>
                  ))
                )}
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="system-prompt">
                    System prompt
                  </label>
                  <Textarea
                    id="system-prompt"
                    rows={3}
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="user-prompt">
                    Your message
                  </label>
                  <Textarea
                    id="user-prompt"
                    rows={5}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask your local model something practical..."
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    The frontend sends your request to the Node backend. The backend
                    calls Ollama and returns a simplified response.
                  </p>
                  <Button disabled={loading} size="lg" type="submit">
                    {loading ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <SendHorizonal className="h-4 w-4" />
                        Send to Ollama
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Model library</CardTitle>
                <CardDescription>
                  Available local models from your Ollama installation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {models.length > 0 ? (
                  models.slice(0, 6).map((model) => (
                    <div
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                      key={model.name}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{model.name}</p>
                        {model.name === modelName ? (
                          <Badge variant="success">Selected</Badge>
                        ) : (
                          <Badge variant="outline">Available</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{formatBytes(model.size)}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                    No models were returned. Make sure Ollama is running and that you
                    pulled at least one model.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Run details</CardTitle>
                <CardDescription>
                  Live status and the most recent generation metadata.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="mb-1 text-sm font-medium text-slate-100">Current status</p>
                  <p className="text-sm leading-6 text-slate-400">{statusText}</p>
                </div>

                {statsText ? (
                  <div className="rounded-2xl border border-sky-400/10 bg-sky-400/10 p-4">
                    <p className="mb-1 text-sm font-medium text-sky-100">
                      Last response stats
                    </p>
                    <p className="text-sm leading-6 text-slate-200">{statsText}</p>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                    <p className="mb-1 text-sm font-medium text-rose-100">Problem</p>
                    <p className="text-sm leading-6 text-slate-200">{error}</p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="mb-1 text-sm font-medium text-slate-100">Manual model override</p>
                  <Input
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    placeholder="qwen2.5:7b"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
