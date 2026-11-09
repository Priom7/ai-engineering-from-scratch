import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createKnowledge, resolveDocsDir } from '../knowledge.js';
import { chat, getOllamaVersion, getRuntimeConfig, unloadModel } from '../ollama.js';
import { runSinglePrompt } from '../single.js';
import { createStore, type Email } from '../store.js';
import { runWorkflow, type StepDeps } from '../workflow/engine.js';
import { loadWorkflow } from '../workflow/load.js';
import type { Outcome, RunRecord, Workflow } from '../workflow/types.js';
import { containsPhrase, GRADE_FORMAT, gradeMessages, gradeOutcome, parseVerdict, regradeResult, summarizeExperiment, type EmailResult } from './grade.js';

// npm run experiment -- <name> [--mode workflow|single] [--check-model <model>] [--no-format] [--only id,id]
// Runs every sample email, grades the replies, and saves data/experiments/<name>.json.
//
// npm run experiment -- <name> --regrade
// Grades the saved replies again with the current rubrics in data/emails.json. Nothing else runs again.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = path.join(root, 'data');
const ANSWER_MODEL = 'llama3.2:3b';
const GRADER_MODEL = 'qwen2.5:7b-instruct';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const name = args[0];
if (!name || name.startsWith('--') || !/^[\w-]+$/.test(name)) {
  console.error('Usage: npm run experiment -- <name> [--mode workflow|single] [--check-model <model>] [--no-format] [--only id,id] [--regrade]');
  process.exit(1);
}
const mode = flag('mode') === 'single' ? 'single' : 'workflow';
const only = flag('only')?.split(',');

// The workflow under test, with this experiment's changes.
const base = loadWorkflow(path.join(root, 'workflows', 'support-desk.json'));
const workflow: Workflow = {
  ...base,
  nodes: base.nodes.map((node) => {
    if (node.type === 'judge' && flag('check-model')) return { ...node, model: flag('check-model')! };
    if (node.type === 'llm-json' && args.includes('--no-format')) return { ...node, useFormat: false };
    return node;
  }),
};
const checkModel = workflow.nodes.find((n) => n.type === 'judge')?.model ?? null;
const useFormat = workflow.nodes.find((n) => n.type === 'llm-json')?.useFormat ?? null;

const store = createStore(dataDir);
const knowledge = createKnowledge(resolveDocsDir(root), dataDir, getRuntimeConfig().embedModel);
const deps: StepDeps = { chat, retrieve: knowledge.retrieveFor };

/** Grades one reply the Episode 3 way: required facts in code, or a rubric judged by the grader model. */
async function gradeReply(email: Email, reply: string | null, outcome: Outcome): Promise<{ replyCorrect: boolean | null; gradeReason: string }> {
  const expected = email.expected!;
  if (!reply || outcome === 'escalated') return { replyCorrect: null, gradeReason: '' };
  if (expected.mustSay) {
    const missing = expected.mustSay.filter((p) => !containsPhrase(reply, p));
    return { replyCorrect: missing.length === 0, gradeReason: missing.length === 0 ? 'Says every required fact.' : `Missing: ${missing.join(', ')}` };
  }
  if (expected.rubric) {
    const { system, user } = gradeMessages(`Subject: ${email.subject}\n\n${email.body}`, expected.rubric, reply);
    const verdict = parseVerdict((await chat({ model: GRADER_MODEL, system, user, temperature: 0, seed: 0, format: GRADE_FORMAT })).content);
    return { replyCorrect: verdict.passed, gradeReason: verdict.reason };
  }
  return { replyCorrect: null, gradeReason: '' };
}

function printSummary(mode: string, summary: ReturnType<typeof summarizeExperiment>, graded: EmailResult[], file: string) {
  console.log(`Support desk experiment: ${name} (${mode})`);
  console.log(`  emails                ${summary.emails}`);
  console.log(`  wrong replies sent    ${summary.sentWrong}`);
  console.log(`  right replies sent    ${summary.sentRight}`);
  console.log(`  caught for review     ${summary.caught}`);
  console.log(`  ready / review / escalated / failed   ${summary.ready} / ${summary.review} / ${summary.escalated} / ${summary.failed}`);
  console.log(`  outages escalated     ${graded.filter((r) => r.expectedRoute === 'escalated' && r.outcome === 'escalated').length}/${graded.filter((r) => r.expectedRoute === 'escalated').length}`);
  if (summary.jsonFirstTry !== null) console.log(`  JSON valid first try  ${Math.round(summary.jsonFirstTry * 100)}%   intent correct ${Math.round((summary.intentAccuracy ?? 0) * 100)}%`);
  console.log(`  median seconds/email  ${summary.medianSeconds}`);
  console.log(`  saved ${path.relative(root, file)}`);
}

const file = path.join(dataDir, 'experiments', `${name}.json`);
const emails = (await store.listEmails()).filter((e) => e.expected && (!only || only.includes(e.id)));

if (args.includes('--regrade')) {
  const saved = JSON.parse(await readFile(file, 'utf8')) as { mode: string; summary: unknown; results: (EmailResult & { reply: string | null; gradeReason: string })[] };
  const byId = new Map(emails.map((e) => [e.id, e]));
  for (const [i, result] of saved.results.entries()) {
    const email = byId.get(result.emailId);
    if (!email) continue;
    const { replyCorrect, gradeReason } = await gradeReply(email, result.reply, result.outcome);
    saved.results[i] = { ...regradeResult(result, replyCorrect), gradeReason };
  }
  await unloadModel(GRADER_MODEL).catch(() => undefined);
  saved.summary = summarizeExperiment(saved.results);
  await writeFile(file, `${JSON.stringify({ ...saved, regradedAt: new Date().toISOString() }, null, 2)}\n`);
  printSummary(saved.mode, saved.summary as ReturnType<typeof summarizeExperiment>, saved.results, file);
  process.exit(0);
}

const runs: RunRecord[] = [];
for (const [i, email] of emails.entries()) {
  const text = `Subject: ${email.subject}\n\n${email.body}`;
  const run = mode === 'single' ? await runSinglePrompt(text, deps, ANSWER_MODEL) : await runWorkflow(workflow, { email: text, emailId: email.id }, deps);
  runs.push({ ...run, emailId: email.id });
  console.error(`  ${i + 1}/${emails.length} ${email.id}: ${run.outcome} in ${(run.durationMs / 1000).toFixed(1)} s`);
}

// Grade every reply with one model loaded at a time.
await Promise.all([ANSWER_MODEL, checkModel].filter((m): m is string => !!m && m !== GRADER_MODEL).map((m) => unloadModel(m).catch(() => undefined)));
const graded = [];
for (const [i, email] of emails.entries()) {
  const run = runs[i];
  const { replyCorrect, gradeReason } = await gradeReply(email, run.reply, run.outcome);
  graded.push({
    ...gradeOutcome(email, run, replyCorrect),
    reply: run.reply,
    gradeReason,
    check: run.context.check ?? null,
    understand: run.context.understand ?? null,
    steps: run.steps.map((s) => ({ nodeId: s.nodeId, durationMs: s.durationMs, modelMs: s.modelMs, loadMs: s.loadMs, attempts: s.attempts.length, status: s.status, error: s.error })),
  });
}
await unloadModel(GRADER_MODEL).catch(() => undefined);

const summary = summarizeExperiment(graded);
await mkdir(path.dirname(file), { recursive: true });
await writeFile(
  file,
  `${JSON.stringify(
    {
      name,
      mode,
      createdAt: new Date().toISOString(),
      settings: { answerModel: ANSWER_MODEL, checkModel: mode === 'workflow' ? checkModel : null, useFormat: mode === 'workflow' ? useFormat : null, graderModel: GRADER_MODEL },
      environment: { ollamaVersion: await getOllamaVersion() },
      summary,
      results: graded,
    },
    null,
    2,
  )}\n`,
);
printSummary(mode, summary, graded, file);
