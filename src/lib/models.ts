// --- Shared Type Definitions ---
export type PromptType =
  | 'summarization' | 'code_generation' | 'qa_simple' | 'qa_complex'
  | 'creative_writing' | 'analysis' | 'translation' | 'math_logic' | 'general_chat';

export type RoutingPriority = 'cost' | 'latency' | 'quality';
export type ProviderType = 'openai' | 'anthropic' | 'google' | 'mistral' | 'togetherai';

export interface RoutingDecision {
  promptType: PromptType;
  selectedModels: Array<{ provider: ProviderType; model: string }>;
  reasoning: string;
  estimatedCost: number;
  priority: RoutingPriority;
}
export interface ModelResponse {
  content?: string;
  providers?: { model: string; provider: ProviderType; }[];
  routingDecision: RoutingDecision;
  actualCost?: number;
  latency?: number;
  error?: string;
}
export interface Message {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  responseDetails?: ModelResponse;
}

// --- Fixed MODEL CONFIGS with NotDiamond-supported models ---
export const MODEL_CONFIGS = {
  // OpenAI Models
  'openai/gpt-4o': { provider: 'openai' as ProviderType, quality: 9, latency: 7, cost: { input: 5.00, output: 15.00 } },
  'openai/gpt-4-turbo': { provider: 'openai' as ProviderType, quality: 10, latency: 5, cost: { input: 10.00, output: 30.00 } }, // Used gpt-4-turbo instead of preview
  'openai/gpt-4o-mini': { provider: 'openai' as ProviderType, quality: 7, latency: 9, cost: { input: 0.15, output: 0.60 } },
  'openai/gpt-3.5-turbo': { provider: 'openai' as ProviderType, quality: 6, latency: 9, cost: { input: 0.50, output: 1.50 } },
    
  // Anthropic Models
  'anthropic/claude-3-5-sonnet-20240620': { provider: 'anthropic' as ProviderType, quality: 9, latency: 7, cost: { input: 3.00, output: 15.00 } },
  'anthropic/claude-3-opus-20240229': { provider: 'anthropic' as ProviderType, quality: 10, latency: 4, cost: { input: 15.00, output: 75.00 } },
  'anthropic/claude-3-haiku-20240307': { provider: 'anthropic' as ProviderType, quality: 7, latency: 9, cost: { input: 0.25, output: 1.25 } },
  'anthropic/claude-3-5-haiku-20241022': { provider: 'anthropic' as ProviderType, quality: 8, latency: 9, cost: { input: 1.00, output: 5.00 } },

  // Google Models
  'google/gemini-1.5-pro-latest': { provider: 'google' as ProviderType, quality: 9, latency: 7, cost: { input: 3.50, output: 10.50 } },
  'google/gemini-1.5-flash-latest': { provider: 'google' as ProviderType, quality: 7, latency: 10, cost: { input: 0.35, output: 1.05 } },

  // Mistral Models
  'mistral/mistral-large-latest': { provider: 'mistral' as ProviderType, quality: 9, latency: 7, cost: { input: 4.00, output: 12.00 } },
  'mistral/mistral-small-latest': { provider: 'mistral' as ProviderType, quality: 7, latency: 8, cost: { input: 1.00, output: 3.00 } },
  'mistral/open-mixtral-8x7b': { provider: 'mistral' as ProviderType, quality: 8, latency: 8, cost: { input: 0.70, output: 0.70 } },

  // TogetherAI Models
  'togetherai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': { provider: 'togetherai' as ProviderType, quality: 9, latency: 7, cost: { input: 0.90, output: 0.90 } },
  'togetherai/Qwen/Qwen2.5-72B-Instruct': { provider: 'togetherai' as ProviderType, quality: 9, latency: 7, cost: { input: 0.90, output: 0.90 } },
  'togetherai/mistralai/Mixtral-8x7B-Instruct-v0.1': { provider: 'togetherai' as ProviderType, quality: 8, latency: 8, cost: { input: 0.60, output: 0.60 } },
} as const;
export type ModelName = keyof typeof MODEL_CONFIGS;

// UPDATED: Routing rules now use the newer/corrected model names
export const DEFAULT_ROUTING_RULES: Record<PromptType, Record<RoutingPriority, ModelName[]>> = {
  general_chat: {
    cost: ['google/gemini-1.5-flash-latest', 'anthropic/claude-3-haiku-20240307', 'openai/gpt-3.5-turbo'],
    latency: ['google/gemini-1.5-flash-latest', 'anthropic/claude-3-5-haiku-20241022', 'openai/gpt-4o-mini'],
    quality: ['anthropic/claude-3-5-sonnet-20240620', 'openai/gpt-4o', 'google/gemini-1.5-pro-latest'],
  },
  code_generation: {
    cost: ['anthropic/claude-3-haiku-20240307', 'mistral/open-mixtral-8x7b', 'openai/gpt-4o-mini'],
    latency: ['anthropic/claude-3-5-haiku-20241022', 'google/gemini-1.5-flash-latest', 'openai/gpt-4o-mini'],
    quality: ['openai/gpt-4-turbo', 'anthropic/claude-3-opus-20240229', 'togetherai/Qwen/Qwen2.5-72B-Instruct'],
  },
  summarization: {
    cost: ['anthropic/claude-3-haiku-20240307', 'google/gemini-1.5-flash-latest', 'openai/gpt-3.5-turbo'],
    latency: ['google/gemini-1.5-flash-latest', 'anthropic/claude-3-5-haiku-20241022', 'openai/gpt-4o-mini'],
    quality: ['openai/gpt-4-turbo', 'anthropic/claude-3-5-sonnet-20240620', 'google/gemini-1.5-pro-latest'],
  },
  qa_simple: {
    cost: ['google/gemini-1.5-flash-latest', 'anthropic/claude-3-haiku-20240307', 'openai/gpt-3.5-turbo'],
    latency: ['google/gemini-1.5-flash-latest', 'anthropic/claude-3-5-haiku-20241022', 'openai/gpt-4o-mini'],
    quality: ['anthropic/claude-3-5-sonnet-20240620', 'openai/gpt-4o', 'google/gemini-1.5-pro-latest'],
  },
  qa_complex: {
    cost: ['anthropic/claude-3-5-sonnet-20240620', 'openai/gpt-4o', 'google/gemini-1.5-pro-latest'],
    latency: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20240620', 'google/gemini-1.5-pro-latest'],
    quality: ['openai/gpt-4-turbo', 'anthropic/claude-3-opus-20240229', 'google/gemini-1.5-pro-latest'],
  },
  creative_writing: {
    cost: ['anthropic/claude-3-haiku-20240307', 'mistral/open-mixtral-8x7b', 'openai/gpt-4o-mini'],
    latency: ['anthropic/claude-3-5-haiku-20241022', 'google/gemini-1.5-flash-latest', 'openai/gpt-4o'],
    quality: ['anthropic/claude-3-opus-20240229', 'openai/gpt-4-turbo', 'mistral/mistral-large-latest'],
  },
  analysis: {
    cost: ['anthropic/claude-3-5-sonnet-20240620', 'google/gemini-1.5-pro-latest', 'openai/gpt-4o'],
    latency: ['google/gemini-1.5-pro-latest', 'anthropic/claude-3-5-sonnet-20240620', 'openai/gpt-4o'],
    quality: ['openai/gpt-4-turbo', 'anthropic/claude-3-opus-20240229', 'google/gemini-1.5-pro-latest'],
  },
  translation: {
    cost: ['google/gemini-1.5-flash-latest', 'anthropic/claude-3-haiku-20240307', 'openai/gpt-3.5-turbo'],
    latency: ['google/gemini-1.5-flash-latest', 'anthropic/claude-3-5-haiku-20241022', 'openai/gpt-4o-mini'],
    quality: ['openai/gpt-4o', 'google/gemini-1.5-pro-latest', 'anthropic/claude-3-5-sonnet-20240620'],
  },
  math_logic: {
    cost: ['google/gemini-1.5-pro-latest', 'anthropic/claude-3-5-sonnet-20240620', 'openai/gpt-4o'],
    latency: ['google/gemini-1.5-flash-latest', 'openai/gpt-4o', 'google/gemini-1.5-pro-latest'],
    quality: ['openai/gpt-4-turbo', 'anthropic/claude-3-opus-20240229', 'google/gemini-1.5-pro-latest'],
  },
};