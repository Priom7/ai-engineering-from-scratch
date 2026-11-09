import 'dotenv/config';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

import { createKnowledge, resolveDocsDir } from './knowledge.js';
import { chat, getRuntimeConfig, listModels } from './ollama.js';
import { runSinglePrompt } from './single.js';
import { createStore } from './store.js';
import { newRunId, runWorkflow, type StepDeps } from './workflow/engine.js';
import { loadWorkflow } from './workflow/load.js';
import type { RunEvent, RunRecord } from './workflow/types.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = path.join(root, 'data');
const port = Number(process.env.PORT ?? 4400);
const docsDir = resolveDocsDir(root);

const workflow = loadWorkflow(path.join(root, 'workflows', 'support-desk.json'));
const store = createStore(dataDir);
const knowledge = createKnowledge(docsDir, dataDir, getRuntimeConfig().embedModel);
const deps: StepDeps = { chat, retrieve: knowledge.retrieveFor };
const SINGLE_MODEL = 'llama3.2:3b';

// Runs in progress: their events so far, and who is listening.
type Live = { events: RunEvent[]; listeners: Set<(event: RunEvent) => void> };
const live = new Map<string, Live>();

const app = express();
app.use(cors({ origin: (origin, callback) => callback(null, !origin || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) }));
app.use(express.json({ limit: '64kb' }));

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

app.get('/api/health', async (_request, response) => {
  try {
    const [models, docs] = await Promise.all([listModels(), knowledge.summary()]);
    response.json({ ok: true, models: (models.models ?? []).map((m) => m.name), ...docs, docsDir });
  } catch (error) {
    response.status(503).json({ ok: false, message: message(error) });
  }
});

app.get('/api/workflow', (_request, response) => {
  response.json(workflow);
});

app.get('/api/emails', async (_request, response) => {
  response.json({ emails: await store.listEmails() });
});

app.post('/api/emails', async (request, response) => {
  try {
    const { from = '', subject = '', body = '' } = request.body ?? {};
    response.status(201).json(await store.addEmail({ from: String(from), subject: String(subject), body: String(body) }));
  } catch (error) {
    response.status(400).json({ message: message(error) });
  }
});

/** Starts a run in the background and returns its id; follow it at /api/runs/:id/events. */
app.post('/api/runs', async (request, response) => {
  const { emailId, email: pastedText, mode = 'workflow' } = request.body ?? {};
  const emails = await store.listEmails();
  const email = emailId ? emails.find((e) => e.id === emailId) : null;
  const text = email ? `Subject: ${email.subject}\n\n${email.body}` : String(pastedText ?? '').trim();
  if (!text) {
    response.status(400).json({ message: 'Send an emailId or the email text.' });
    return;
  }

  const runId = newRunId();
  const entry: Live = { events: [], listeners: new Set() };
  live.set(runId, entry);
  const emit = (event: RunEvent) => {
    entry.events.push(event);
    entry.listeners.forEach((listener) => listener(event));
  };

  const finish = async (run: RunRecord) => {
    const saved = { ...run, id: runId, emailId: email?.id ?? null };
    await store.saveRun(saved);
    emit({ type: 'run-end', run: saved });
    setTimeout(() => live.delete(runId), 60_000);
  };

  (async () => {
    try {
      if (mode === 'single') {
        await finish(await runSinglePrompt(text, deps, SINGLE_MODEL));
      } else {
        await finish(await runWorkflow(workflow, { email: text, emailId: email?.id ?? null }, deps, (e) => e.type !== 'run-end' && emit(e)));
      }
    } catch (error) {
      emit({
        type: 'run-end',
        run: { id: runId, workflowId: workflow.id, mode, emailId: email?.id ?? null, email: text, startedAt: new Date().toISOString(), durationMs: 0, outcome: 'failed', reply: null, context: { error: message(error) }, steps: [] },
      });
    }
  })();

  response.status(202).json({ runId });
});

/** Server-sent events: everything so far, then each new step as it happens. */
app.get('/api/runs/:id/events', async (request, response) => {
  response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  response.flushHeaders();
  const send = (event: RunEvent) => response.write(`data: ${JSON.stringify(event)}\n\n`);

  const entry = live.get(request.params.id);
  if (!entry) {
    // Already finished: replay it from disk.
    const run = await store.readRun(request.params.id);
    if (run) {
      run.steps.forEach((trace) => send({ type: 'step-end', trace }));
      send({ type: 'run-end', run });
    }
    response.end();
    return;
  }
  entry.events.forEach(send);
  if (entry.events.some((e) => e.type === 'run-end')) {
    response.end();
    return;
  }
  const listener = (event: RunEvent) => {
    send(event);
    if (event.type === 'run-end') response.end();
  };
  entry.listeners.add(listener);
  request.on('close', () => entry.listeners.delete(listener));
});

app.get('/api/runs', async (_request, response) => {
  response.json({ runs: await store.listRuns() });
});

app.get('/api/runs/:id', async (request, response) => {
  const run = await store.readRun(request.params.id);
  if (!run) {
    response.status(404).json({ message: `No run ${request.params.id}.` });
    return;
  }
  response.json(run);
});

/** Saved experiment results (npm run experiment), for the Results view. */
app.get('/api/experiments', async (_request, response) => {
  const dir = path.join(dataDir, 'experiments');
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => /^[\w-]+\.json$/.test(f));
  } catch {
    // No experiments yet.
  }
  const experiments = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))));
  response.json({ experiments });
});

app.listen(port, () => {
  console.log(`Support desk backend on http://localhost:${port} (documents: ${docsDir})`);
});
