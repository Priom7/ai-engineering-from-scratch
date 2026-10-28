import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chat, embedText, getModelDigest, getOllamaVersion, getRuntimeConfig, unloadModel } from '../../backend/src/ollama.js';
import { buildContext, DEFAULT_SYSTEM_PROMPT, retrieve, type RagSettings } from '../../backend/src/rag.js';
import { compareRuns } from './compare.js';
import { selectQuestions, validateDataset } from './dataset.js';
import { checkGate } from './gate.js';
import { JUDGE_FORMAT, judgeMessages, parseJudge } from './graders.js';
import { loadIndex } from './indexes.js';
import { formatCompare, formatRun } from './report.js';
import { runEval } from './runner.js';
import { summarize } from './summary.js';
import type { Question, RunFile, RunSettings } from './types.js';

const evalsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultPath = (config: string) => path.join(evalsDir, 'results', `${config}.json`);
const judgeModel = process.env.JUDGE_MODEL ?? 'qwen2.5:7b-instruct';
const readJson = async <T>(file: string) => JSON.parse(await readFile(file, 'utf8')) as T;

const [command, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : (args[index + 1] ?? '');
};
const VALUE_FLAGS = new Set(['--repeats', '--only', '--name', '--baseline']);
const positional = args.filter((arg, i) => !arg.startsWith('--') && !VALUE_FLAGS.has(args[i - 1]));

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

async function loadQuestions(): Promise<Question[]> {
  const result = validateDataset(await readJson(path.join(evalsDir, 'dataset', 'questions.json')));
  if ('error' in result) fail(`Dataset error: ${result.error}`);
  return result.questions;
}

type ConfigSettings = RagSettings & Pick<RunSettings, 'documents'>;

async function loadSettings(config: string): Promise<ConfigSettings> {
  const configs = await readJson<Record<string, Partial<ConfigSettings>>>(path.join(evalsDir, 'configs.json'));
  if (!configs[config]) fail(`Unknown config "${config}". Choose one of: ${Object.keys(configs).join(', ')}`);
  const settings = { ...configs.baseline, ...configs[config] } as ConfigSettings;
  if (settings.systemPrompt === 'default') settings.systemPrompt = DEFAULT_SYSTEM_PROMPT;
  return settings;
}

async function run() {
  const config = positional[0] ?? fail('Usage: npm run eval -- <config> [--repeats 3] [--retrieval-only] [--only id,id] [--name results-name]');
  const repeats = Number(flag('repeats') ?? 3);
  const retrievalOnly = args.includes('--retrieval-only');
  const only = flag('only')?.split(',').filter(Boolean);
  const name = flag('name') ?? config;
  const questions = selectQuestions(await loadQuestions(), only);
  const settings = await loadSettings(config);
  const { embedModel } = getRuntimeConfig();
  const chunks = await loadIndex(settings.chunkSize, settings.chunkOverlap, embedText, embedModel, settings.documents);

  const { attempts, hits } = await runEval(
    questions,
    chunks,
    settings,
    repeats,
    { embed: embedText, send: chat, unload: unloadModel, judgeModel, onProgress: (m) => process.stderr.write(`\r  ${m}      `) },
    { retrievalOnly },
  );
  process.stderr.write('\n');

  const models = retrievalOnly ? [embedModel] : [settings.chatModel, judgeModel, embedModel];
  const run: RunFile = {
    config,
    createdAt: new Date().toISOString(),
    settings: { ...settings, repeats: retrievalOnly ? 0 : repeats, judgeModel },
    environment: {
      ollamaVersion: await getOllamaVersion(),
      models: Object.fromEntries(await Promise.all(models.map(async (m) => [m, await getModelDigest(m)]))),
    },
    attempts,
    hits,
    summary: summarize(questions, attempts, hits),
  };
  await writeFile(resultPath(name), `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  console.log(formatRun(run));
}

async function compare() {
  const [a, b] = positional;
  if (!a || !b) fail('Usage: npm run eval:compare -- <base config> <target config>');
  const base = await readJson<RunFile>(resultPath(a));
  const target = await readJson<RunFile>(resultPath(b));
  console.log(formatCompare(base, target, compareRuns(base, target)));
}

async function check() {
  const config = positional[0] ?? fail('Usage: npm run eval:check -- <config> [--baseline evals/baseline.json]');
  const baselinePath = path.resolve(flag('baseline') ?? path.join(evalsDir, 'baseline.json'));
  const baseline = await readJson<RunFile>(baselinePath).catch(() =>
    fail(`No baseline at ${baselinePath}. Save one with: cp evals/results/baseline.json evals/baseline.json`, 2),
  );
  const run = await readJson<RunFile>(resultPath(config));
  const result = checkGate(baseline.summary, run.summary);
  console.log(`Checking ${config} against the baseline (margin 5 points)`);
  if (result.ok) {
    console.log('  ✓ no regressions against the baseline');
    return;
  }
  for (const reason of result.reasons) console.log(`  ✗ ${reason}`);
  fail(`Blocked: ${result.reasons.length} regression${result.reasons.length === 1 ? '' : 's'}.`);
}

/** Runs answers a person labelled pass or fail through the judge, and counts disagreements. */
async function judgeCheck() {
  const questions = new Map((await loadQuestions()).map((q) => [q.id, q]));
  const labels = await readJson<{ questionId: string; answer: string; pass: boolean; note: string }[]>(
    path.join(evalsDir, 'dataset', 'judge-labels.json'),
  );
  const settings = await loadSettings('baseline');
  const chunks = await loadIndex(settings.chunkSize, settings.chunkOverlap, embedText, getRuntimeConfig().embedModel);

  const misses: string[] = [];
  let falsePasses = 0;
  let falseFails = 0;
  for (const label of labels) {
    const q = questions.get(label.questionId) ?? fail(`judge-labels.json: unknown question ${label.questionId}`);
    const matches = await retrieve(q.question, chunks, settings.topK, embedText);
    const { system, user } = judgeMessages(q, label.answer, buildContext(matches));
    const reply = await chat({ model: judgeModel, system, user, temperature: 0, seed: 0, format: JUDGE_FORMAT });
    const verdict = parseJudge(reply.content);
    if (verdict.passed !== label.pass) {
      if (verdict.passed) falsePasses += 1;
      else falseFails += 1;
      misses.push(
        `  ✗ ${q.id}: labelled ${label.pass ? 'pass' : 'fail'}, judge said ${verdict.passed ? 'pass' : 'fail'}\n` +
          `    answer: "${label.answer}"\n    judge:  ${verdict.reason}`,
      );
    }
  }
  await unloadModel(judgeModel);

  console.log(`Judge check: ${judgeModel} on ${labels.length} labelled answers`);
  console.log(`  agreed        ${labels.length - misses.length}/${labels.length}`);
  console.log(`  false passes  ${falsePasses}`);
  console.log(`  false fails   ${falseFails}`);
  if (misses.length) console.log(['', ...misses].join('\n'));
}

const commands: Record<string, () => Promise<void>> = { run, compare, check, 'judge-check': judgeCheck };
await (commands[command] ?? (() => fail(`Unknown command "${command}". Use run, compare, check or judge-check.`)))();
