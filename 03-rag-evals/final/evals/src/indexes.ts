import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chunkText, sanitizeText } from '../../backend/src/text.js';
import type { StoredChunk } from '../../backend/src/types.js';

const evalsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.resolve(evalsDir, '../sample-docs');
const cacheDir = path.join(evalsDir, '.cache');

/**
 * Chunks and embeds the sample documents (all, or the ones listed) the same way the upload route does.
 * Embeddings are cached per chunk setting, and rebuilt when a document changes.
 */
export async function loadIndex(
  chunkSize: number,
  chunkOverlap: number,
  embed: (text: string) => Promise<number[]>,
  embedModel: string,
  documents?: string[],
): Promise<StoredChunk[]> {
  const all = (await readdir(docsDir)).filter((name) => name.endsWith('.md')).sort();
  const missing = (documents ?? []).filter((name) => !all.includes(name));
  if (missing.length > 0) throw new Error(`No such sample document: ${missing.join(', ')}`);
  const names = documents ? all.filter((name) => documents.includes(name)) : all;
  const docs = await Promise.all(names.map(async (name) => ({ name, text: await readFile(path.join(docsDir, name), 'utf8') })));

  const hash = createHash('sha256');
  hash.update(JSON.stringify({ chunkSize, chunkOverlap, embedModel, docs }));
  const cachePath = path.join(cacheDir, `index-${chunkSize}-${chunkOverlap}-${hash.digest('hex').slice(0, 12)}.json`);

  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as StoredChunk[];
  } catch {
    // Not cached yet.
  }

  const chunks: StoredChunk[] = [];
  for (const doc of docs) {
    const pieces = chunkText(sanitizeText(doc.text), chunkSize, chunkOverlap);
    for (const [index, text] of pieces.entries()) {
      chunks.push({ id: `${doc.name}#${index}`, documentId: doc.name, documentName: doc.name, text, embedding: await embed(text) });
    }
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(chunks), 'utf8');
  return chunks;
}
