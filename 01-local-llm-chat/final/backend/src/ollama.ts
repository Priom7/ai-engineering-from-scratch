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
  const response = await fetch(buildUrl('/api/tags'));

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as OllamaTagsResponse;
  return data.models ?? [];
}

export async function chatWithModel(input: {
  model?: string;
  systemPrompt?: string;
  messages: ChatMessage[];
}) {
  const messages = input.messages.filter(
    (message) => message.content && message.content.trim().length > 0,
  );

  if (messages.length === 0) {
    throw new Error('At least one message is required.');
  }

  const finalMessages =
    input.systemPrompt && input.systemPrompt.trim().length > 0
      ? [{ role: 'system' as const, content: input.systemPrompt.trim() }, ...messages]
      : messages;

  const response = await fetch(buildUrl('/api/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model?.trim() || defaultModel,
      messages: finalMessages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as OllamaChatResponse;

  return {
    model: data.model,
    reply: data.message?.content ?? '',
    stats: {
      promptTokens: data.prompt_eval_count ?? 0,
      responseTokens: data.eval_count ?? 0,
      totalDurationMs:
        typeof data.total_duration === 'number'
          ? Math.round(data.total_duration / 1_000_000)
          : null,
      doneReason: data.done_reason ?? 'unknown',
    },
  };
}

