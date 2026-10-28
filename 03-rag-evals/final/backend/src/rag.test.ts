import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ChatRequest, ChatResult } from './ollama.js';
import { buildContext, DEFAULT_SYSTEM_PROMPT, generate, rankMatches, retrieve } from './rag.js';
import type { SearchMatch, StoredChunk } from './types.js';

const chunk = (id: string, embedding: number[], documentName = 'refunds.md'): StoredChunk => ({
  id,
  documentId: 'doc',
  documentName,
  text: `text of ${id}`,
  embedding,
});

const chunks = [chunk('a', [1, 0]), chunk('b', [0, 1]), chunk('c', [0.7, 0.7])];
const embedAs = (vector: number[]) => async () => vector;

function fakeSend() {
  const requests: ChatRequest[] = [];
  const send = async (request: ChatRequest): Promise<ChatResult> => {
    requests.push(request);
    return { model: request.model, content: 'answer', durationMs: 5, promptTokens: 0, responseTokens: 0 };
  };
  return { requests, send };
}

const matches: SearchMatch[] = [
  { chunkId: 'a', documentId: 'doc', documentName: 'refunds.md', score: 0.9, text: 'Refunds within 30 days.' },
  { chunkId: 'b', documentId: 'doc', documentName: 'support.md', score: 0.5, text: 'Chat is open weekdays.' },
];

test('rankMatches sorts by cosine similarity, best first', () => {
  assert.deepEqual(
    rankMatches(chunks, [1, 0]).map((m) => m.chunkId),
    ['a', 'c', 'b'],
  );
});

test('retrieve returns only the top k', async () => {
  const result = await retrieve('question', chunks, 2, embedAs([1, 0]));
  assert.deepEqual(
    result.map((m) => m.chunkId),
    ['a', 'c'],
  );
});

test('buildContext numbers sources from 1 in rank order', () => {
  assert.equal(
    buildContext(matches),
    '[Source 1: refunds.md]\nRefunds within 30 days.\n\n[Source 2: support.md]\nChat is open weekdays.',
  );
});

test('generate sends the system prompt and the Episode 2 user format', async () => {
  const { requests, send } = fakeSend();
  await generate('Q?', matches, { chatModel: 'llama3.2:3b', systemPrompt: DEFAULT_SYSTEM_PROMPT }, send);
  assert.equal(requests[0].model, 'llama3.2:3b');
  assert.equal(requests[0].system, DEFAULT_SYSTEM_PROMPT);
  assert.equal(requests[0].user, `Question:\nQ?\n\nContext:\n${buildContext(matches)}`);
});

test('generate passes the seed when given and omits it when not', async () => {
  const { requests, send } = fakeSend();
  const settings = { chatModel: 'llama3.2:3b', systemPrompt: DEFAULT_SYSTEM_PROMPT };
  await generate('Q?', matches, settings, send, 3);
  await generate('Q?', matches, settings, send);
  assert.equal(requests[0].seed, 3);
  assert.equal('seed' in requests[1], false);
});
