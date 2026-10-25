import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import multer from 'multer';

import { answerQuestion, embedText, getRuntimeConfig, listModels } from './ollama.js';
import { loadStore, saveStore } from './store.js';
import { chunkText, cosineSimilarity, sanitizeText } from './text.js';
import type { SearchMatch, StoredChunk, StoredDocument } from './types.js';

const app = express();
const port = Number(process.env.PORT ?? 4100);
const configuredFrontendOrigin = process.env.FRONTEND_ORIGIN?.trim();
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(moduleDir, '../../uploads');
const chunkSize = Number(process.env.MAX_CHUNK_SIZE ?? 500);
const chunkOverlap = Number(process.env.CHUNK_OVERLAP ?? 80);

await mkdir(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (configuredFrontendOrigin && origin === configuredFrontendOrigin) {
        callback(null, true);
        return;
      }

      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

      if (isLocalDevOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
  }),
);
app.use(express.json({ limit: '2mb' }));

function rankMatches(chunks: StoredChunk[], queryEmbedding: number[]): SearchMatch[] {
  return chunks
    .map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((left, right) => right.score - left.score);
}

app.get('/api/config', (_request, response) => {
  response.json({
    appName: 'RAG Workspace Assistant 002',
    ...getRuntimeConfig(),
    chunkSize,
    chunkOverlap,
  });
});

app.get('/api/health', async (_request, response) => {
  try {
    const models = await listModels();
    const store = await loadStore();

    response.json({
      ok: true,
      modelCount: models.models?.length ?? 0,
      documentCount: store.documents.length,
      chunkCount: store.chunks.length,
      runtime: getRuntimeConfig(),
    });
  } catch (error) {
    response.status(503).json({
      ok: false,
      message:
        error instanceof Error ? error.message : 'Could not reach Ollama or local store.',
    });
  }
});

app.get('/api/models', async (_request, response) => {
  try {
    response.json(await listModels());
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : 'Could not list models.',
    });
  }
});

app.get('/api/documents', async (_request, response) => {
  const store = await loadStore();
  response.json({
    documents: store.documents,
    chunkCount: store.chunks.length,
  });
});

app.post('/api/documents/upload', upload.single('file'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'A file is required.' });
    return;
  }

  try {
    const extension = path.extname(request.file.originalname).toLowerCase();

    if (!['.txt', '.md'].includes(extension)) {
      response.status(400).json({
        message: 'Only .txt and .md files are supported in this beginner version.',
      });
      return;
    }

    const raw = await readFile(request.file.path, 'utf8');
    const cleaned = sanitizeText(raw);

    if (!cleaned) {
      response.status(400).json({
        message: 'The uploaded file is empty after cleaning.',
      });
      return;
    }

    const chunks = chunkText(cleaned, chunkSize, chunkOverlap);
    const documentId = randomUUID();
    const store = await loadStore();

    const document: StoredDocument = {
      id: documentId,
      fileName: request.file.filename,
      originalName: request.file.originalname,
      uploadedAt: new Date().toISOString(),
      contentLength: cleaned.length,
      chunkCount: chunks.length,
    };

    const storedChunks: StoredChunk[] = [];

    for (const text of chunks) {
      const embedding = await embedText(text);
      storedChunks.push({
        id: randomUUID(),
        documentId,
        documentName: request.file.originalname,
        text,
        embedding,
      });
    }

    store.documents.push(document);
    store.chunks.push(...storedChunks);
    await saveStore(store);

    response.json({
      document,
      chunkCount: storedChunks.length,
    });
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : 'Failed to ingest the file.',
    });
  } finally {
    await unlink(request.file.path).catch(() => undefined);
  }
});

app.post('/api/query', async (request, response) => {
  const question = String(request.body?.question ?? '').trim();

  if (!question) {
    response.status(400).json({ message: 'A question is required.' });
    return;
  }

  const store = await loadStore();

  if (store.chunks.length === 0) {
    response.status(400).json({
      message: 'Upload at least one document before asking a question.',
    });
    return;
  }

  try {
    const queryEmbedding = await embedText(question);
    const matches = rankMatches(store.chunks, queryEmbedding).slice(0, 4);
    const context = matches
      .map(
        (match, index) =>
          `[Source ${index + 1}: ${match.documentName}]\n${match.text}`,
      )
      .join('\n\n');

    const result = await answerQuestion({ question, context });

    response.json({
      question,
      answer: result.answer,
      model: result.model,
      stats: result.stats,
      citations: matches.map((match) => ({
        documentName: match.documentName,
        score: Number(match.score.toFixed(4)),
        preview: match.text.slice(0, 220),
      })),
    });
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : 'Query failed.',
    });
  }
});

app.post('/api/reset', async (_request, response) => {
  await saveStore({
    documents: [],
    chunks: [],
  });
  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`RAG Workspace Assistant backend is running on http://localhost:${port}`);
});
