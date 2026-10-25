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
  const response = await fetch(buildUrl('/api/embed'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: embedModel,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    embeddings?: number[][];
  };

  return data.embeddings?.[0] ?? [];
}

export async function answerQuestion(input: {
  question: string;
  context: string;
}) {
  const response = await fetch(buildUrl('/api/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: chatModel,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are a retrieval assistant. Answer only from the provided context. If the answer is not in the context, say that clearly. Keep the answer concise and practical.',
        },
        {
          role: 'user',
          content: `Question:\n${input.question}\n\nContext:\n${input.context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    model: string;
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
  };

  return {
    model: data.model,
    answer: data.message?.content ?? '',
    stats: {
      promptTokens: data.prompt_eval_count ?? 0,
      responseTokens: data.eval_count ?? 0,
      totalDurationMs:
        typeof data.total_duration === 'number'
          ? Math.round(data.total_duration / 1_000_000)
          : null,
    },
  };
}

