import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { embedText } from './ollama.js';
import { retrieve } from './rag.js';
import { chunkText, sanitizeText } from './text.js';
import type { SearchMatch, StoredChunk } from './types.js';

// The documents the support desk answers from: every .md and .txt file in
// DOCS_DIR, chunked and embedded the same way as Episode 2. The embeddings are
// cached, and rebuilt when a document changes.

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;

/** The documents folder: DOCS_DIR (relative to the backend folder), or the sample documents. */
export function resolveDocsDir(root: string, docsDir = process.env.DOCS_DIR): string {
  return path.resolve(root, 'backend', docsDir ?? '../sample-docs');
}

export function createKnowledge(docsDir: string, cacheDir: string, embedModel: string) {
  let index: Promise<StoredChunk[]> | null = null;

  async function build(): Promise<StoredChunk[]> {
    const names = (await readdir(docsDir)).filter((name) => /\.(md|txt)$/i.test(name)).sort();
    const docs = await Promise.all(names.map(async (name) => ({ name, text: await readFile(path.join(docsDir, name), 'utf8') })));
    const hash = createHash('sha256').update(JSON.stringify({ embedModel, docs, CHUNK_SIZE, CHUNK_OVERLAP })).digest('hex').slice(0, 12);
    const cacheFile = path.join(cacheDir, `index-${hash}.json`);
    try {
      return JSON.parse(await readFile(cacheFile, 'utf8')) as StoredChunk[];
    } catch {
      // Not cached yet.
    }
    const chunks: StoredChunk[] = [];
    for (const doc of docs) {
      for (const [i, text] of chunkText(sanitizeText(doc.text), CHUNK_SIZE, CHUNK_OVERLAP).entries()) {
        chunks.push({ id: `${doc.name}#${i}`, documentId: doc.name, documentName: doc.name, text, embedding: await embedText(text) });
      }
    }
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(chunks));
    return chunks;
  }

  /** The index, built once per process (and on first use). */
  const getIndex = () => (index ??= build().catch((error) => {
    index = null;
    throw error;
  }));

  async function retrieveFor(query: string, topK: number): Promise<SearchMatch[]> {
    return retrieve(query, await getIndex(), topK, embedText);
  }

  async function summary() {
    const chunks = await getIndex();
    return { documents: new Set(chunks.map((c) => c.documentName)).size, chunks: chunks.length };
  }

  return { getIndex, retrieveFor, summary };
}
