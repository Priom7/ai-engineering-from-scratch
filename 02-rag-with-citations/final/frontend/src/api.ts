export interface HealthResponse {
  ok: boolean;
  modelCount: number;
  documentCount: number;
  chunkCount: number;
  runtime: {
    ollamaBaseUrl: string;
    chatModel: string;
    embedModel: string;
  };
  message?: string;
}

export interface DocumentSummary {
  id: string;
  originalName: string;
  uploadedAt: string;
  contentLength: number;
  chunkCount: number;
}

export interface Citation {
  documentName: string;
  score: number;
  preview: string;
}

export interface QueryResponse {
  question: string;
  answer: string;
  model: string;
  stats: {
    promptTokens: number;
    responseTokens: number;
    totalDurationMs: number | null;
  };
  citations: Citation[];
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4100';

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const data = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.');
  }

  return data;
}

export function fetchHealth() {
  return readJson<HealthResponse>('/api/health');
}

export function fetchDocuments() {
  return readJson<{ documents: DocumentSummary[]; chunkCount: number }>('/api/documents');
}

export function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return readJson<{ document: DocumentSummary; chunkCount: number }>(
    '/api/documents/upload',
    {
      method: 'POST',
      body: formData,
    },
  );
}

export function queryKnowledgeBase(question: string) {
  return readJson<QueryResponse>('/api/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });
}

export function resetKnowledgeBase() {
  return readJson<{ ok: boolean }>('/api/reset', {
    method: 'POST',
  });
}

