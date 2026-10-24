export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModelSummary {
  name: string;
  size?: number;
  modified_at?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface ChatResponse {
  model: string;
  reply: string;
  stats: {
    promptTokens: number;
    responseTokens: number;
    totalDurationMs: number | null;
    doneReason: string;
  };
}

