const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const chatModel = process.env.OLLAMA_CHAT_MODEL ?? 'llama3.2:3b';
const embedModel = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text:latest';

function buildUrl(path: string) {
  return new URL(path, ollamaBaseUrl).toString();
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  return text || `Ollama request failed with status ${response.status}`;
}

export function getRuntimeConfig() {
  return {
    ollamaBaseUrl,
    chatModel,
    embedModel,
  };
}

export async function listModels() {
  const response = await fetch(buildUrl('/api/tags'));

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as {
    models?: Array<{ name: string; size?: number; modified_at?: string }>;
  };
}

export async function embedText(text: string): Promise<number[]> {
  // TODO 1: POST to /api/embed with { model: embedModel, input: text }.
  // TODO 2: If the response isn't ok, throw new Error(await parseError(response)).
  // TODO 3: Return data.embeddings[0] (an array of numbers), or [] if it's missing.
  throw new Error('TODO: embedText is not implemented yet.');
}
export async function answerQuestion(input: {
  question: string;
  context: string;
}) {
  // TODO 1: POST to /api/chat with stream: false and two messages:
  //         - system: answer ONLY from the provided context, and say so clearly when
  //           the answer isn't in it
  //         - user: the question and the context
  // TODO 2: If the response isn't ok, throw a readable error (see parseError).
  // TODO 3: Return { model, answer, stats } where stats has promptTokens,
  //         responseTokens and totalDurationMs (Ollama reports nanoseconds).
  throw new Error('TODO: answerQuestion is not implemented yet.');
}
