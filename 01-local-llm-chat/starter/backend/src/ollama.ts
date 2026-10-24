import type {
  ChatMessage,
  OllamaChatResponse,
  OllamaModel,
  OllamaTagsResponse,
} from './types.js';

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const defaultModel = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';

function buildUrl(path: string): string {
  return new URL(path, ollamaBaseUrl).toString();
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  return text || `Ollama request failed with status ${response.status}`;
}

export function getOllamaConfig() {
  return {
    baseUrl: ollamaBaseUrl,
    defaultModel,
  };
}

export async function listModels(): Promise<OllamaModel[]> {
  // TODO 1: GET /api/tags from Ollama. buildUrl() turns a path into a full URL.
  // TODO 2: If the response isn't ok, throw new Error(await parseError(response)).
  // TODO 3: Return data.models, or an empty array if it's missing.
  throw new Error('TODO: listModels is not implemented yet.');
}

export async function chatWithModel(input: {
  model?: string;
  systemPrompt?: string;
  messages: ChatMessage[];
}) {
  // TODO 1: Drop messages whose content is empty or only whitespace.
  // TODO 2: If nothing is left, throw new Error('At least one message is required.').
  // TODO 3: If there's a system prompt, put { role: 'system', content } first.
  // TODO 4: POST to /api/chat with { model, messages, stream: false }.
  //         Use input.model, or defaultModel when it's empty.
  // TODO 5: If the response isn't ok, throw a readable error (see parseError).
  // TODO 6: Return { model, reply, stats }. Stats are promptTokens, responseTokens,
  //         totalDurationMs (Ollama reports nanoseconds) and doneReason.
  throw new Error('TODO: chatWithModel is not implemented yet.');
}

