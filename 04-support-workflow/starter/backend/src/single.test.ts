import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ChatRequest } from './ollama.js';
import { runSinglePrompt } from './single.js';

test('answers with one retrieval and one model call, and always sends', async () => {
  const requests: ChatRequest[] = [];
  const run = await runSinglePrompt(
    'Can I get a refund?',
    {
      chat: async (request) => {
        requests.push(request);
        return { model: request.model, content: 'Yes, within 30 days.', durationMs: 50, promptTokens: 0, responseTokens: 0 };
      },
      retrieve: async () => [{ chunkId: 'c', documentId: 'd', documentName: 'refunds.md', score: 0.8, text: 'Refunds within 30 days.' }],
    },
    'llama3.2:3b',
  );
  assert.equal(requests.length, 1);
  assert.equal(run.mode, 'single');
  assert.equal(run.outcome, 'ready');
  assert.equal(run.reply, 'Yes, within 30 days.');
  assert.deepEqual(
    run.steps.map((s) => s.nodeId),
    ['find', 'answer'],
  );
});
