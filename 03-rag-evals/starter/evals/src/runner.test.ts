import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ChatRequest, ChatResult } from '../../backend/src/ollama.js';
import { DEFAULT_SYSTEM_PROMPT, type RagSettings } from '../../backend/src/rag.js';
import type { StoredChunk } from '../../backend/src/types.js';
import { runEval, type RunDeps } from './runner.js';
import type { Question } from './types.js';

const settings: RagSettings = { chunkSize: 500, chunkOverlap: 80, topK: 1, chatModel: 'chat', systemPrompt: DEFAULT_SYSTEM_PROMPT };

const chunks: StoredChunk[] = [
  { id: '1', documentId: 'refunds.md', documentName: 'refunds.md', text: 'Refunds arrive within 5 to 10 business days.', embedding: [1, 0] },
  { id: '2', documentId: 'support.md', documentName: 'support.md', text: 'Live chat is open on weekdays.', embedding: [0, 1] },
];

const questions: Question[] = [
  {
    id: 'refund-speed',
    question: 'How long do refunds take?',
    source: 'refunds.md',
    evidence: ['within 5 to 10 business days'],
    grade: { type: 'facts', mustSay: ['5 to 10 business days'] },
  },
  { id: 'student-discount', question: 'Student discount?', source: null, evidence: [], grade: { type: 'refuse' } },
];

function fakeDeps(options: { failSeed?: number } = {}) {
  const log: string[] = [];
  const chatSeeds: number[] = [];
  const deps: RunDeps = {
    embed: async () => [1, 0],
    send: async (request: ChatRequest): Promise<ChatResult> => {
      log.push(`send:${request.model}`);
      if (request.model === 'chat' && request.seed !== undefined) chatSeeds.push(request.seed);
      if (request.model === 'chat' && request.seed === options.failSeed) throw new Error('Ollama timed out');
      const content = request.model === 'judge' ? '{"reason":"ok","verdict":"pass"}' : 'Refunds take 5 to 10 business days.';
      return { model: request.model, content, durationMs: 100, promptTokens: 0, responseTokens: 0 };
    },
    unload: async (model: string) => {
      log.push(`unload:${model}`);
    },
    judgeModel: 'judge',
  };
  return { deps, log, chatSeeds };
}

test('generates every answer before grading', async () => {
  const { deps, log } = fakeDeps();
  await runEval(questions, chunks, settings, 2, deps);
  assert.ok(log.lastIndexOf('send:chat') < log.indexOf('send:judge'));
});

test('uses seed = attempt number', async () => {
  const { deps, chatSeeds } = fakeDeps();
  await runEval(questions.slice(0, 1), chunks, settings, 3, deps);
  assert.deepEqual(chatSeeds, [1, 2, 3]);
});

test('records a thrown send as a failed attempt and continues', async () => {
  const { deps } = fakeDeps({ failSeed: 2 });
  const { attempts } = await runEval(questions.slice(0, 1), chunks, settings, 3, deps);
  assert.equal(attempts.length, 3);
  assert.equal(attempts[1].passed, false);
  assert.match(attempts[1].error ?? '', /timed out/);
  assert.equal(attempts[2].passed, true);
});

test('skips generation with retrievalOnly', async () => {
  const { deps, log } = fakeDeps();
  const { attempts, hits } = await runEval(questions, chunks, settings, 3, deps, { retrievalOnly: true });
  assert.deepEqual(log, []);
  assert.deepEqual(attempts, []);
  assert.deepEqual(hits, { 'refund-speed': true });
});

test('unloads the chat model before judging when the models differ', async () => {
  const { deps, log } = fakeDeps();
  await runEval(questions, chunks, settings, 1, deps);
  assert.ok(log.indexOf('unload:chat') < log.indexOf('send:judge'));
  assert.ok(log.indexOf('unload:chat') > log.lastIndexOf('send:chat'));
});

test('grades facts with code and refusals with the judge', async () => {
  const { deps } = fakeDeps();
  const { attempts } = await runEval(questions, chunks, settings, 1, deps);
  assert.equal(attempts.find((a) => a.questionId === 'refund-speed')?.reason, 'Says every required fact.');
  assert.equal(attempts.find((a) => a.questionId === 'student-discount')?.reason, 'ok');
});
