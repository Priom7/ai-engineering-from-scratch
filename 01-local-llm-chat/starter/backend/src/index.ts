import 'dotenv/config';

import cors from 'cors';
import express from 'express';

import { chatWithModel, getOllamaConfig, listModels } from './ollama.js';
import type { ChatRequestBody } from './types.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

app.use(
  cors({
    origin: frontendOrigin,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/config', (_request, response) => {
  response.json({
    appName: 'Ollama Chat 001',
    defaultModel: getOllamaConfig().defaultModel,
  });
});

app.get('/api/health', async (_request, response) => {
  // TODO: Call listModels(). On success, reply with
  //       { ok: true, ollamaReachable: true, modelCount, defaultModel }.
  //       If Ollama can't be reached, reply 503 with { ok: false, ollamaReachable: false, message }.
  response.status(501).json({ message: 'TODO: /api/health is not implemented yet.' });
});

app.get('/api/models', async (_request, response) => {
  // TODO: Reply with { models } from listModels(), or 502 with { message } if it fails.
  response.status(501).json({ message: 'TODO: /api/models is not implemented yet.' });
});

app.post('/api/chat', async (request, response) => {
  const body = request.body as ChatRequestBody;

  // TODO 1: If body.messages isn't a non-empty array, reply 400 with a clear message.
  // TODO 2: Call chatWithModel() with the model, system prompt and messages.
  // TODO 3: Reply with its result, or 502 with { message } if it throws.
  response.status(501).json({ message: 'TODO: /api/chat is not implemented yet.', received: body });
});

app.listen(port, () => {
  console.log(`Ollama Chat 001 backend is running on http://localhost:${port}`);
});

