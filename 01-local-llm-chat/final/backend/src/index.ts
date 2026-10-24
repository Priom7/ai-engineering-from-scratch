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
  try {
    const models = await listModels();

    response.json({
      ok: true,
      ollamaReachable: true,
      modelCount: models.length,
      defaultModel: getOllamaConfig().defaultModel,
    });
  } catch (error) {
    response.status(503).json({
      ok: false,
      ollamaReachable: false,
      message:
        error instanceof Error
          ? error.message
          : 'Could not reach Ollama. Is it running on your machine?',
    });
  }
});

app.get('/api/models', async (_request, response) => {
  try {
    const models = await listModels();
    response.json({ models });
  } catch (error) {
    response.status(502).json({
      message:
        error instanceof Error
          ? error.message
          : 'Could not load models from Ollama.',
    });
  }
});

app.post('/api/chat', async (request, response) => {
  const body = request.body as ChatRequestBody;

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    response.status(400).json({
      message: 'The request needs a non-empty messages array.',
    });
    return;
  }

  try {
    const result = await chatWithModel({
      model: body.model,
      systemPrompt: body.systemPrompt,
      messages: body.messages,
    });

    response.json(result);
  } catch (error) {
    response.status(502).json({
      message:
        error instanceof Error ? error.message : 'Chat request to Ollama failed.',
    });
  }
});

app.listen(port, () => {
  console.log(`Ollama Chat 001 backend is running on http://localhost:${port}`);
});

