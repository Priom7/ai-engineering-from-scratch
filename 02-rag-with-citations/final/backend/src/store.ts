import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { KnowledgeBase } from './types.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(moduleDir, '../data');
const storePath = path.join(dataDir, 'knowledge-base.json');

const emptyStore: KnowledgeBase = {
  documents: [],
  chunks: [],
};

export async function loadStore(): Promise<KnowledgeBase> {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(storePath, 'utf8');
    return JSON.parse(raw) as KnowledgeBase;
  } catch {
    return emptyStore;
  }
}

export async function saveStore(store: KnowledgeBase) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}
