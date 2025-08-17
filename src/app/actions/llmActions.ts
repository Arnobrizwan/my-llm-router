'use server';

import { NotDiamond } from 'notdiamond';

// Initialize NotDiamond client
const notDiamond = new NotDiamond({
  apiKey: process.env.NOTDIAMOND_API_KEY,
});

// --- Type Definitions ---
export type PromptType =
  | 'summarization'
  | 'code_generation'
  | 'qa_simple'
  | 'qa_complex'
  | 'creative_writing'
  | 'analysis'
  | 'translation'
  | 'math_logic'
  | 'general_chat';

export type RoutingPriority = 'cost' | 'latency' | 'quality';
type ProviderType = 'openai' | 'anthropic' | 'google' | 'mistral' | 'togetherai';

export interface RoutingDecision {
  promptType: PromptType;
  selectedModels: Array<{ provider: string; model: string }>;
  reasoning: string;
  estimatedCost: number;
  priority: RoutingPriority;
}

export interface ModelResponse {
  content?: string;
  providers?: { model: string; provider: string }[];
  routingDecision: RoutingDecision;
  actualCost?: number;
  latency?: number;
  error?: string;
}

// --- MODEL CONFIGS with NotDiamond-supported models and REAL PRICING ---
const MODEL_CONFIGS = {
  // OpenAI Models (NotDiamond format)
  'openai/gpt-4o': {
    provider: 'openai' as ProviderType,
    quality: 9,
    latency: 7,
    cost: { input: 5.0, output: 15.0 },
  },
  'openai/gpt-4-turbo': {
    provider: 'openai' as ProviderType,
    quality: 10,
    latency: 5,
    cost: { input: 10.0, output: 30.0 },
  },
  'openai/gpt-4o-mini': {
    provider: 'openai' as ProviderType,
    quality: 7,
    latency: 9,
    cost: { input: 0.15, output: 0.6 },
  },
  'openai/gpt-3.5-turbo': {
    provider: 'openai' as ProviderType,
    quality: 6,
    latency: 9,
    cost: { input: 0.5, output: 1.5 },
  },
  
  // Anthropic Models (NotDiamond format)
  'anthropic/claude-3-5-sonnet-20241022': {
    provider: 'anthropic' as ProviderType,
    quality: 10,
    latency: 6,
    cost: { input: 3.0, output: 15.0 },
  },
  'anthropic/claude-3-5-sonnet-20240620': {
    provider: 'anthropic' as ProviderType,
    quality: 9,
    latency: 8,
    cost: { input: 3.0, output: 15.0 },
  },
  'anthropic/claude-3-opus-20240229': {
    provider: 'anthropic' as ProviderType,
    quality: 10,
    latency: 4,
    cost: { input: 15.0, output: 75.0 },
  },
  'anthropic/claude-3-haiku-20240307': {
    provider: 'anthropic' as ProviderType,
    quality: 7,
    latency: 9,
    cost: { input: 0.25, output: 1.25 },
  },
  'anthropic/claude-3-5-haiku-20241022': {
    provider: 'anthropic' as ProviderType,
    quality: 8,
    latency: 9,
    cost: { input: 1.0, output: 5.0 },
  },
  
  // Google Models (NotDiamond format)
  'google/gemini-1.5-pro-latest': {
    provider: 'google' as ProviderType,
    quality: 9,
    latency: 8,
    cost: { input: 3.5, output: 10.5 },
  },
  'google/gemini-1.5-flash-latest': {
    provider: 'google' as ProviderType,
    quality: 6,
    latency: 10,
    cost: { input: 0.35, output: 1.05 },
  },
  
  // Mistral Models (NotDiamond format)
  'mistral/mistral-large-latest': {
    provider: 'mistral' as ProviderType,
    quality: 9,
    latency: 7,
    cost: { input: 4.0, output: 12.0 },
  },
  'mistral/mistral-small-latest': {
    provider: 'mistral' as ProviderType,
    quality: 7,
    latency: 9,
    cost: { input: 1.0, output: 3.0 },
  },
  'mistral/open-mixtral-8x7b': {
    provider: 'mistral' as ProviderType,
    quality: 8,
    latency: 8,
    cost: { input: 0.7, output: 0.7 },
  },
  
  // TogetherAI Models (NotDiamond format)
  'togetherai/Llama-3-70b-chat-hf': {
    provider: 'togetherai' as ProviderType,
    quality: 9,
    latency: 7,
    cost: { input: 0.9, output: 0.9 },
  },
  'togetherai/Qwen2-72B-Instruct': {
    provider: 'togetherai' as ProviderType,
    quality: 9,
    latency: 7,
    cost: { input: 0.9, output: 0.9 },
  },
  'togetherai/Mixtral-8x7B-Instruct-v0.1': {
    provider: 'togetherai' as ProviderType,
    quality: 8,
    latency: 8,
    cost: { input: 0.6, output: 0.6 },
  },
};

type ModelName = keyof typeof MODEL_CONFIGS;

// --- Default routing rules with corrected model names ---
const DEFAULT_ROUTING_RULES: Record<
  PromptType,
  Record<RoutingPriority, ModelName[]>
> = {
  general_chat: {
    cost: [
      'google/gemini-1.5-flash-latest',
      'anthropic/claude-3-haiku-20240307',
      'openai/gpt-3.5-turbo',
    ],
    latency: [
      'google/gemini-1.5-flash-latest',
      'anthropic/claude-3-5-haiku-20241022',
      'openai/gpt-4o-mini',
    ],
    quality: [
      'anthropic/claude-3-5-sonnet-20241022',
      'openai/gpt-4-turbo',
      'anthropic/claude-3-opus-20240229',
    ],
  },
  code_generation: {
    cost: [
      'anthropic/claude-3-haiku-20240307',
      'mistral/open-mixtral-8x7b',
      'openai/gpt-4o-mini',
    ],
    latency: [
      'anthropic/claude-3-5-haiku-20241022',
      'google/gemini-1.5-flash-latest',
      'openai/gpt-4o-mini',
    ],
    quality: [
      'openai/gpt-4-turbo',
      'anthropic/claude-3-5-sonnet-20241022',
      'anthropic/claude-3-opus-20240229',
    ],
  },
  summarization: {
    cost: [
      'anthropic/claude-3-haiku-20240307',
      'google/gemini-1.5-flash-latest',
      'openai/gpt-3.5-turbo',
    ],
    latency: [
      'google/gemini-1.5-flash-latest',
      'anthropic/claude-3-5-haiku-20241022',
      'openai/gpt-4o-mini',
    ],
    quality: [
      'openai/gpt-4-turbo',
      'anthropic/claude-3-5-sonnet-20241022',
      'google/gemini-1.5-pro-latest',
    ],
  },
  qa_simple: {
    cost: [
      'google/gemini-1.5-flash-latest',
      'anthropic/claude-3-haiku-20240307',
      'openai/gpt-3.5-turbo',
    ],
    latency: [
      'google/gemini-1.5-flash-latest',
      'anthropic/claude-3-5-haiku-20241022',
      'openai/gpt-4o-mini',
    ],
    quality: [
      'anthropic/claude-3-5-sonnet-20240620',
      'openai/gpt-4o',
      'google/gemini-1.5-pro-latest',
    ],
  },
  qa_complex: {
    cost: [
      'anthropic/claude-3-5-sonnet-20240620',
      'openai/gpt-4o',
      'google/gemini-1.5-pro-latest',
    ],
    latency: [
      'openai/gpt-4o',
      'anthropic/claude-3-5-sonnet-20240620',
      'google/gemini-1.5-pro-latest',
    ],
    quality: [
      'openai/gpt-4-turbo',
      'anthropic/claude-3-opus-20240229',
      'anthropic/claude-3-5-sonnet-20241022',
    ],
  },
  creative_writing: {
    cost: [
      'anthropic/claude-3-haiku-20240307',
      'google/gemini-1.5-pro-latest',
      'openai/gpt-4o-mini',
    ],
    latency: [
      'anthropic/claude-3-5-haiku-20241022',
      'google/gemini-1.5-flash-latest',
      'openai/gpt-4o',
    ],
    quality: [
      'anthropic/claude-3-opus-20240229',
      'openai/gpt-4-turbo',
      'anthropic/claude-3-5-sonnet-20241022',
    ],
  },
  analysis: {
    cost: [
      'anthropic/claude-3-5-sonnet-20240620',
      'google/gemini-1.5-pro-latest',
      'openai/gpt-4o',
    ],
    latency: [
      'google/gemini-1.5-pro-latest',
      'anthropic/claude-3-5-sonnet-20240620',
      'openai/gpt-4o',
    ],
    quality: [
      'openai/gpt-4-turbo',
      'anthropic/claude-3-opus-20240229',
      'anthropic/claude-3-5-sonnet-20241022',
    ],
  },
  translation: {
    cost: [
      'google/gemini-1.5-flash-latest',
      'anthropic/claude-3-haiku-20240307',
      'openai/gpt-3.5-turbo',
    ],
    latency: [
      'google/gemini-1.5-flash-latest',
      'anthropic/claude-3-5-haiku-20241022',
      'openai/gpt-4o-mini',
    ],
    quality: [
      'anthropic/claude-3-5-sonnet-20240620',
      'google/gemini-1.5-pro-latest',
      'openai/gpt-4o',
    ],
  },
  math_logic: {
    cost: [
      'google/gemini-1.5-pro-latest',
      'anthropic/claude-3-5-sonnet-20240620',
      'openai/gpt-4o',
    ],
    latency: [
      'google/gemini-1.5-flash-latest',
      'google/gemini-1.5-pro-latest',
      'openai/gpt-4o',
    ],
    quality: [
      'openai/gpt-4-turbo',
      'anthropic/claude-3-opus-20240229',
      'anthropic/claude-3-5-sonnet-20241022',
    ],
  },
};

// --- Helper Functions ---
function getAvailableProviders(excludeProviders: string[] = []): Array<{ provider: string; model: string }> {
  const providers: Array<{ provider: string; model: string }> = [];
  
  console.log('[Debug] Environment API Keys Check:');
  console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not Set');
  console.log('- ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not Set');
  console.log('- GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Set' : 'Not Set');
  console.log('- MISTRAL_API_KEY:', process.env.MISTRAL_API_KEY ? 'Set' : 'Not Set');
  console.log('- TOGETHER_API_KEY:', process.env.TOGETHER_API_KEY ? 'Set' : 'Not Set');
  console.log('- Excluded Providers:', excludeProviders);
  
  if (process.env.OPENAI_API_KEY && !excludeProviders.includes('openai')) {
    const openaiModels = Object.keys(MODEL_CONFIGS)
      .filter((k) => MODEL_CONFIGS[k as ModelName].provider === 'openai')
      .map((m) => ({ provider: 'openai', model: m }));
    providers.push(...openaiModels);
    console.log('- Added OpenAI models:', openaiModels.length);
  }
  
  if (process.env.ANTHROPIC_API_KEY && !excludeProviders.includes('anthropic')) {
    const anthropicModels = Object.keys(MODEL_CONFIGS)
      .filter((k) => MODEL_CONFIGS[k as ModelName].provider === 'anthropic')
      .map((m) => ({ provider: 'anthropic', model: m }));
    providers.push(...anthropicModels);
    console.log('- Added Anthropic models:', anthropicModels.length);
  }
  
  if (process.env.GOOGLE_API_KEY && !excludeProviders.includes('google')) {
    const googleModels = Object.keys(MODEL_CONFIGS)
      .filter((k) => MODEL_CONFIGS[k as ModelName].provider === 'google')
      .map((m) => ({ provider: 'google', model: m }));
    providers.push(...googleModels);
    console.log('- Added Google models:', googleModels.length);
  }
  
  if (process.env.MISTRAL_API_KEY && !excludeProviders.includes('mistral')) {
    const mistralModels = Object.keys(MODEL_CONFIGS)
      .filter((k) => MODEL_CONFIGS[k as ModelName].provider === 'mistral')
      .map((m) => ({ provider: 'mistral', model: m }));
    providers.push(...mistralModels);
    console.log('- Added Mistral models:', mistralModels.length);
  }
  
  if (process.env.TOGETHER_API_KEY && !excludeProviders.includes('togetherai')) {
    const togetherModels = Object.keys(MODEL_CONFIGS)
      .filter((k) => MODEL_CONFIGS[k as ModelName].provider === 'togetherai')
      .map((m) => ({ provider: 'togetherai', model: m }));
    providers.push(...togetherModels);
    console.log('- Added TogetherAI models:', togetherModels.length);
  }
  
  console.log(`[Available Providers] Total models available: ${providers.length}`);
  console.log('[Available Providers] By provider:', 
    Object.entries(
      providers.reduce((acc, p) => {
        acc[p.provider] = (acc[p.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([provider, count]) => `${provider}: ${count}`).join(', ')
  );
  
  return providers;
}

export async function classifyPrompt(prompt: string): Promise<PromptType> {
  const lower = prompt.toLowerCase();
  
  // Enhanced classification logic
  if (/\b(summarize|summary|tldr|brief|outline|key points|main points)\b/.test(lower)) {
    return 'summarization';
  }
  
  if (
    /```|def |function |class |import |<\w+>/.test(prompt) ||
    /\b(code|python|javascript|react|sql|html|css|api|debug|fix|build)\b/.test(lower)
  ) {
    return 'code_generation';
  }
  
  if (/\b(analyze|analysis|compare|contrast|evaluate|assess|examine)\b/.test(lower)) {
    return 'analysis';
  }
  
  if (/\b(translate|translation|language|french|spanish|german|chinese)\b/.test(lower)) {
    return 'translation';
  }
  
  if (/\b(calculate|solve|equation|math|logic|proof|statistics)\b/.test(lower)) {
    return 'math_logic';
  }
  
  if (/\b(creative|story|poem|fiction|write|novel|character|plot)\b/.test(lower)) {
    return 'creative_writing';
  }
  
  if (prompt.length > 200 || /\b(explain in detail|comprehensive|thorough)\b/.test(lower)) {
    return 'qa_complex';
  }
  
  if (/\?|what|how|why|when|where|who/.test(lower)) {
    return 'qa_simple';
  }
  
  return 'general_chat';
}

function calculateActualCost(
  modelName: ModelName,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const config = MODEL_CONFIGS[modelName];
  if (!config || !usage) return 0;
  return (
    (usage.prompt_tokens / 1_000_000) * config.cost.input +
    (usage.completion_tokens / 1_000_000) * config.cost.output
  );
}

export async function routePrompt(
  prompt: string,
  priority: RoutingPriority = 'cost',
  excludeProviders?: string[]
): Promise<RoutingDecision> {
  console.log(`[Routing] Starting route selection for prompt type classification...`);
  console.log(`[Routing] Priority: ${priority}`);
  console.log(`[Routing] Excluded providers: ${excludeProviders?.length ? excludeProviders.join(', ') : 'None'}`);
  
  const promptType = await classifyPrompt(prompt);
  console.log(`[Routing] Classified prompt as: ${promptType}`);
  
  const available = getAvailableProviders(excludeProviders).map((p) => p.model);
  console.log(`[Routing] Available models: ${available.length} models`);
  
  const recommended = DEFAULT_ROUTING_RULES[promptType][priority];
  console.log(`[Routing] Recommended models for ${promptType}/${priority}:`, recommended);
  
  // Filter recommended models by availability, but get more models as backup
  let selected = recommended.filter((m) => available.includes(m));
  console.log(`[Routing] Initially selected models:`, selected);
  
  // If we don't have enough models, add from other priority categories as fallback
  if (selected.length < 3) {
    console.log(`[Routing] Only ${selected.length} models available, looking for fallbacks...`);
    const allPriorities: RoutingPriority[] = ['cost', 'latency', 'quality'];
    for (const fallbackPriority of allPriorities) {
      if (fallbackPriority !== priority) {
        const fallbackRecommended = DEFAULT_ROUTING_RULES[promptType][fallbackPriority];
        const fallbackModels = fallbackRecommended.filter(
          (m) => available.includes(m) && !selected.includes(m)
        );
        console.log(`[Routing] Fallback from ${fallbackPriority}:`, fallbackModels);
        selected = [...selected, ...fallbackModels];
        if (selected.length >= 5) break; // Get up to 5 models for better fallback options
      }
    }
  }
  
  // Take up to 5 models for better fallback coverage
  selected = selected.slice(0, 5);
  console.log(`[Routing] Final selected models:`, selected);

  const estimatedCost =
    selected.length > 0
      ? selected.reduce(
          (sum, model) =>
            sum +
            calculateActualCost(model, {
              prompt_tokens: 500,
              completion_tokens: 150,
            }),
          0
        ) / selected.length
      : 0;

  const reasoning = `Classified as ${promptType}. Optimizing for ${priority}. Selected models: ${selected.join(', ')}.${excludeProviders?.length ? ` Excluded providers: ${excludeProviders.join(', ')}.` : ''}`;

  const result = {
    promptType,
    selectedModels: selected.map((model) => ({
      provider: MODEL_CONFIGS[model as ModelName].provider,
      model,
    })),
    reasoning,
    estimatedCost,
    priority,
  };
  
  console.log(`[Routing] Routing decision:`, {
    promptType: result.promptType,
    selectedModels: result.selectedModels.map(m => `${m.provider}/${m.model.split('/')[1] || m.model}`),
    excludedProviders: excludeProviders || [],
  });

  return result;
}

export async function logRoutingDecision(
  decision: RoutingDecision,
  actualCost?: number,
  latency?: number,
  success: boolean = true
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    promptType: decision.promptType,
    priority: decision.priority,
    selectedModels: decision.selectedModels.map(m => `${m.provider}/${m.model.split('/')[1] || m.model}`),
    estimatedCost: decision.estimatedCost,
    actualCost,
    latency,
    success,
    reasoning: decision.reasoning
  };
  
  console.log('[Routing Analytics]', JSON.stringify(logEntry, null, 2));
}

// --- Main Function ---
export async function getModelResponseWithRouting(
  prompt: string,
  priority: RoutingPriority = 'cost',
  customRules?: Partial<Record<PromptType, string[]>>,
  excludeProviders?: string[] // New parameter to exclude providers with insufficient credits
): Promise<ModelResponse> {
  const start = Date.now();

  const defaultDecision: RoutingDecision = {
    promptType: 'general_chat',
    selectedModels: [],
    reasoning: 'Error occurred before routing',
    estimatedCost: 0,
    priority,
  };

  if (!prompt?.trim()) {
    return { error: 'Prompt cannot be empty.', routingDecision: defaultDecision };
  }
  
  if (!process.env.NOTDIAMOND_API_KEY) {
    return {
      error: 'NotDiamond API key is not configured.',
      routingDecision: defaultDecision,
    };
  }

  let routingDecision: RoutingDecision;
  try {
    routingDecision = await routePrompt(prompt, priority, excludeProviders);

    // Apply custom rules if provided
    if (customRules?.[routingDecision.promptType]) {
      const customCandidates = customRules[routingDecision.promptType]!;
      const available = getAvailableProviders(excludeProviders);
      const validCustom = customCandidates
        .map((m) => available.find((p) => p.model === m || p.model.includes(m)))
        .filter(Boolean) as Array<{ provider: string; model: string }>;

      if (validCustom.length > 0) {
        routingDecision.selectedModels = validCustom;
        routingDecision.reasoning += ' Applied custom rules.';
      }
    }

    if (!routingDecision.selectedModels.length) {
      await logRoutingDecision(routingDecision, undefined, undefined, false);
      return {
        error: `No models available for ${routingDecision.promptType} with priority ${priority}. Please configure API keys for: OpenAI, Anthropic, Google, Mistral, or TogetherAI.`,
        routingDecision,
      };
    }

    // Validate that we have the required API keys for selected models
    const missingKeys: string[] = [];
    const selectedProviders = [...new Set(routingDecision.selectedModels.map(m => m.provider))];
    
    console.log('[API Key Validation] Checking required keys for providers:', selectedProviders);
    
    if (selectedProviders.includes('openai') && !process.env.OPENAI_API_KEY) {
      missingKeys.push('OPENAI_API_KEY');
    }
    if (selectedProviders.includes('anthropic') && !process.env.ANTHROPIC_API_KEY) {
      missingKeys.push('ANTHROPIC_API_KEY');
    }
    if (selectedProviders.includes('google') && !process.env.GOOGLE_API_KEY) {
      missingKeys.push('GOOGLE_API_KEY');
    }
    if (selectedProviders.includes('mistral') && !process.env.MISTRAL_API_KEY) {
      missingKeys.push('MISTRAL_API_KEY');
    }
    if (selectedProviders.includes('togetherai') && !process.env.TOGETHER_API_KEY) {
      missingKeys.push('TOGETHER_API_KEY');
    }
    
    console.log('[API Key Validation] Missing keys:', missingKeys.length ? missingKeys : 'None');
    
    // Also log which providers are available vs unavailable
    const allProviders = ['openai', 'anthropic', 'google', 'mistral', 'togetherai'];
    const availableProviders = allProviders.filter(provider => {
      const envKey = `${provider.toUpperCase()}${provider === 'togetherai' ? '' : '_API'}${provider === 'togetherai' ? '' : '_KEY'}`;
      const actualKey = provider === 'togetherai' ? 'TOGETHER_API_KEY' : `${provider.toUpperCase()}_API_KEY`;
      return process.env[actualKey];
    });
    const unavailableProviders = allProviders.filter(p => !availableProviders.includes(p));
    
    console.log('[Provider Status] Available:', availableProviders.join(', ') || 'None');
    console.log('[Provider Status] Unavailable (missing API keys):', unavailableProviders.join(', ') || 'None');
    
    if (missingKeys.length > 0) {
      await logRoutingDecision(routingDecision, undefined, undefined, false);
      return {
        error: `Missing required API keys for selected models: ${missingKeys.join(', ')}. To use Mistral and TogetherAI, set MISTRAL_API_KEY and TOGETHER_API_KEY environment variables.`,
        routingDecision,
      };
    }

    console.log('[Intelligent Routing]', routingDecision.reasoning);
    console.log('[Selected Models]', routingDecision.selectedModels.map(m => m.model));

    // Call NotDiamond API with automatic fallback for billing/quota errors
    let result;
    let currentExcludeProviders = excludeProviders || [];
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite loops
    
    while (attempts < maxAttempts) {
      try {
        // Get fresh routing decision with current exclusions
        if (attempts > 0) {
          routingDecision = await routePrompt(prompt, priority, currentExcludeProviders);
          
          if (!routingDecision.selectedModels.length) {
            throw new Error(`No models available after excluding providers: ${currentExcludeProviders.join(', ')}`);
          }
          
          console.log(`[Auto Retry ${attempts}] Re-routing without excluded providers:`, currentExcludeProviders);
          console.log('[New Selected Models]', routingDecision.selectedModels.map(m => m.model));
        }
        
        // Debug: Log the exact structure being sent to NotDiamond
        console.log('[NotDiamond Debug] Selected Models:', JSON.stringify(routingDecision.selectedModels, null, 2));
        
        // Convert to the format NotDiamond expects based on their documentation
        const llmProviders = routingDecision.selectedModels.map(m => {
          let modelName = m.model;
          
          // Remove provider prefix if it exists (e.g., 'openai/gpt-4o' -> 'gpt-4o')
          if (modelName.includes('/')) {
            modelName = modelName.split('/')[1];
          }
          
          // Map some model names to NotDiamond's expected format
          const modelMap: { [key: string]: string } = {
            'gpt-4-turbo': 'gpt-4-turbo-2024-04-09',
            'mistral-large-latest': 'mistral-large-2407',
          };
          
          modelName = modelMap[modelName] || modelName;
          
          return {
            provider: m.provider,
            model: modelName,
          };
        });
        
        console.log('[NotDiamond Debug] Formatted Providers:', JSON.stringify(llmProviders, null, 2));
        
        const apiCall = {
          messages: [{ content: prompt, role: 'user' }],
          llmProviders: llmProviders,
        };
        
        console.log('[NotDiamond Debug] API Call Structure:', JSON.stringify(apiCall, null, 2));
        
        result = await notDiamond.create(apiCall);
        
        console.log('[NotDiamond Debug] Raw Result:', JSON.stringify(result, null, 2));
        
        // If we get here, the call was successful
        break;
        
      } catch (apiError) {
        attempts++;
        console.error(`[NotDiamond API Error - Attempt ${attempts}]`, apiError);
        
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        const errorString = errorMessage.toLowerCase();
        
        // Check for billing/quota/credit related errors
        const isBillingError = 
          errorString.includes('credit balance is too low') ||
          errorString.includes('insufficient_funds') ||
          errorString.includes('exceeded your current quota') ||
          errorString.includes('quota exceeded') ||
          errorString.includes('billing') ||
          errorString.includes('payment') ||
          errorString.includes('insufficient credits') ||
          errorString.includes('rate limit') ||
          errorString.includes('429') ||
          errorString.includes('402');
        
        if (isBillingError && attempts < maxAttempts) {
          // Try to identify which provider failed
          let failedProvider = '';
          
          // Check error message for provider hints
          if (errorString.includes('anthropic') || errorString.includes('claude')) {
            failedProvider = 'anthropic';
          } else if (errorString.includes('openai') || errorString.includes('gpt')) {
            failedProvider = 'openai';
          } else if (errorString.includes('google') || errorString.includes('gemini')) {
            failedProvider = 'google';
          } else if (errorString.includes('mistral')) {
            failedProvider = 'mistral';
          } else if (errorString.includes('together')) {
            failedProvider = 'togetherai';
          } else {
            // If we can't identify the specific provider, exclude the first one from current selection
            const currentProviders = routingDecision.selectedModels.map(m => m.provider);
            failedProvider = currentProviders[0];
            console.log(`[Auto Fallback] Could not identify failed provider from error, defaulting to first provider: ${failedProvider}`);
          }
          
          if (failedProvider && !currentExcludeProviders.includes(failedProvider)) {
            console.log(`[Auto Fallback] 🚫 EXCLUDING PROVIDER: ${failedProvider.toUpperCase()}`);
            console.log(`[Auto Fallback] Reason: ${isBillingError ? 'Billing/Quota Error' : 'API Error'}`);
            console.log(`[Auto Fallback] Error snippet: ${errorMessage.substring(0, 100)}...`);
            console.log(`[Auto Fallback] Previously excluded: [${currentExcludeProviders.join(', ')}]`);
            
            currentExcludeProviders = [...currentExcludeProviders, failedProvider];
            console.log(`[Auto Fallback] Now excluding: [${currentExcludeProviders.join(', ')}]`);
            continue; // Retry with excluded provider
          } else if (failedProvider) {
            console.log(`[Auto Fallback] ${failedProvider} already excluded, trying next provider...`);
            // Find next provider to exclude
            const remainingProviders = routingDecision.selectedModels
              .map(m => m.provider)
              .filter(p => !currentExcludeProviders.includes(p));
            
            console.log(`[Auto Fallback] Remaining providers to try: [${remainingProviders.join(', ')}]`);
            
            if (remainingProviders.length > 0) {
              const nextToExclude = remainingProviders[0];
              console.log(`[Auto Fallback] 🚫 EXCLUDING NEXT PROVIDER: ${nextToExclude.toUpperCase()}`);
              currentExcludeProviders = [...currentExcludeProviders, nextToExclude];
              console.log(`[Auto Fallback] Now excluding: [${currentExcludeProviders.join(', ')}]`);
              continue;
            } else {
              console.log(`[Auto Fallback] ❌ No more providers to try!`);
            }
          }
        }
        
        // If we get here, either it's not a billing error or we've exhausted retry options
        console.error('[NotDiamond API Error Stack]', apiError instanceof Error ? apiError.stack : 'No stack trace');
        throw new Error(`NotDiamond API call failed after ${attempts} attempts: ${errorMessage}`);
      }
    }
    
    if (!result) {
      throw new Error(`Failed to get result after ${maxAttempts} attempts`);
    }

    // Enhanced result validation
    if (!result) {
      throw new Error('NotDiamond returned no result (undefined).');
    }
    
    if (typeof result === 'object' && 'detail' in result) {
      throw new Error(`NotDiamond API error: ${result.detail}`);
    }

    // More robust content extraction
    let content: string | undefined;
    if (typeof result === 'string') {
      content = result;
    } else if (typeof result === 'object' && result !== null) {
      content = (result as any).content || (result as any).message || (result as any).text;
    }

    // Better providers handling
    let providers: Array<{ model: string; provider: string }> | undefined;
    if (typeof result === 'object' && result !== null && 'providers' in result) {
      providers = (result as any).providers;
    }

    // If we still don't have providers, create a fallback based on what we know
    if (!providers || !Array.isArray(providers) || providers.length === 0) {
      console.warn('[Warning] No providers returned by NotDiamond, using fallback');
      providers = routingDecision.selectedModels.map(m => ({
        model: m.model,
        provider: m.provider
      }));
    }

    const latency = Date.now() - start;
    
    // Safe access to model information
    let modelUsed: ModelName | undefined;
    let actualCost = routingDecision.estimatedCost;
    
    if (providers && providers.length > 0) {
      const providerEntry = providers[0];
      if (providerEntry?.model) {
        modelUsed = providerEntry.model as ModelName;
        
        // Calculate actual cost if usage data is available
        const usage = (result as any)?.usage as { prompt_tokens: number; completion_tokens: number } | undefined;
        if (usage && modelUsed && MODEL_CONFIGS[modelUsed]) {
          actualCost = calculateActualCost(modelUsed, usage);
        }
      }
    }

    await logRoutingDecision(routingDecision, actualCost, latency, true);

    return {
      content,
      providers,
      routingDecision,
      actualCost,
      latency,
    };
    
  } catch (err) {
    const latency = Date.now() - start;
    routingDecision = routingDecision || defaultDecision;
    
    await logRoutingDecision(routingDecision, undefined, latency, false);

    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('[Routing Error]', errorMessage);

    return {
      error: `Routing failed: ${errorMessage}`,
      routingDecision,
    };
  }
}