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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
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
    models?: Array<{ name: string; size?: number; modified_at?: string; digest?: string }>;
  };
}

export async function embedText(text: string): Promise<number[]> {
  const data = await postJson<{ embeddings?: number[][] }>('/api/embed', {
    model: embedModel,
    input: text,
  });

  return data.embeddings?.[0] ?? [];
}

export type ChatRequest = {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  seed?: number;
  /** A JSON schema the reply must follow. */
  format?: object;
};

export type ChatResult = {
  model: string;
  content: string;
  durationMs: number;
  promptTokens: number;
  responseTokens: number;
};

/** One chat turn. Temperature and seed are only sent when set, so the model's defaults apply otherwise. */
export async function chat(request: ChatRequest): Promise<ChatResult> {
  const options: Record<string, number> = {};
  if (request.temperature !== undefined) options.temperature = request.temperature;
  if (request.seed !== undefined) options.seed = request.seed;

  const data = await postJson<{
    model: string;
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
  }>('/api/chat', {
    model: request.model,
    stream: false,
    ...(request.format ? { format: request.format } : {}),
    ...(Object.keys(options).length > 0 ? { options } : {}),
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
  });

  return {
    model: data.model,
    content: data.message?.content?.trim() ?? '',
    durationMs: Math.round((data.total_duration ?? 0) / 1_000_000),
    promptTokens: data.prompt_eval_count ?? 0,
    responseTokens: data.eval_count ?? 0,
  };
}

/** Frees the model's memory now instead of after Ollama's idle timeout. */
export async function unloadModel(model: string) {
  await postJson('/api/generate', { model, keep_alive: 0 });
}

export async function getOllamaVersion(): Promise<string> {
  const response = await fetch(buildUrl('/api/version'));
  const data = (await response.json()) as { version?: string };
  return data.version ?? 'unknown';
}

/** The first 12 characters of the model's digest, so a run records exactly which weights it used. */
export async function getModelDigest(model: string): Promise<string | null> {
  const { models } = await listModels();
  const found = models?.find((m) => m.name === model || m.name === `${model}:latest`);
  return found?.digest?.slice(0, 12) ?? null;
}
