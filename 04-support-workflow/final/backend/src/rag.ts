import type { ChatRequest, ChatResult } from './ollama.js';
import { cosineSimilarity } from './text.js';
import type { SearchMatch, StoredChunk } from './types.js';

// The question-answering pipeline from Episode 2, in one place. The API route
// and the evals both call it, so the evals test exactly what users get.

export const DEFAULT_SYSTEM_PROMPT =
  'You are a retrieval assistant. Answer only from the provided context. If the answer is not in the context, say that clearly. Keep the answer concise and practical.';

export type RagSettings = {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  chatModel: string;
  systemPrompt: string;
};

export function rankMatches(chunks: StoredChunk[], queryEmbedding: number[]): SearchMatch[] {
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

export function buildContext(matches: SearchMatch[]): string {
  return matches.map((match, index) => `[Source ${index + 1}: ${match.documentName}]\n${match.text}`).join('\n\n');
}

/** The top `topK` chunks for a question. */
export async function retrieve(
  question: string,
  chunks: StoredChunk[],
  topK: number,
  embed: (text: string) => Promise<number[]>,
): Promise<SearchMatch[]> {
  return rankMatches(chunks, await embed(question)).slice(0, topK);
}

/** Answers from the retrieved chunks only. */
export function generate(
  question: string,
  matches: SearchMatch[],
  settings: Pick<RagSettings, 'chatModel' | 'systemPrompt'>,
  send: (request: ChatRequest) => Promise<ChatResult>,
  seed?: number,
): Promise<ChatResult> {
  return send({
    model: settings.chatModel,
    system: settings.systemPrompt,
    user: `Question:\n${question}\n\nContext:\n${buildContext(matches)}`,
    ...(seed !== undefined ? { seed } : {}),
  });
}
