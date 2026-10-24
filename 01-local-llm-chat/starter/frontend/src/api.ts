import type { ChatMessage, ChatResponse, ModelSummary } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const data = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.');
  }

  return data;
}

export async function fetchConfig() {
  return readJson<{ appName: string; defaultModel: string }>('/api/config');
}

export async function fetchHealth() {
  return readJson<{
    ok: boolean;
    ollamaReachable: boolean;
    modelCount: number;
    defaultModel: string;
    message?: string;
  }>('/api/health');
}

export async function fetchModels() {
  return readJson<{ models: ModelSummary[] }>('/api/models');
}

export async function sendChat(input: {
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
}) {
  return readJson<ChatResponse>('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

