export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequestBody {
  model?: string;
  systemPrompt?: string;
  messages?: ChatMessage[];
}

export interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  models?: OllamaModel[];
}

export interface OllamaChatResponse {
  model: string;
  message?: {
    role: 'assistant';
    content: string;
  };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

