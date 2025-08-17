'use server';

import { NotDiamond } from 'notdiamond';
import { MODEL_CONFIGS, DEFAULT_ROUTING_RULES } from '@/lib/models';
import type { ModelName, RoutingDecision, ModelResponse, PromptType, RoutingPriority, ProviderType, ProviderHealth } from '@/lib/models';

// Initialize NotDiamond client
const notDiamond = new NotDiamond({
  apiKey: process.env.NOTDIAMOND_API_KEY,
});

// --- NEW: In-Memory Store for Health Checks ---
const providerHealth = new Map<ProviderType, ProviderHealth>();

// --- NEW: Health Check System ---
function reportFailure(provider: ProviderType) {
  const status = providerHealth.get(provider) || { failureCount: 0 };
  status.failureCount++;
  if (status.failureCount >= 3) {
    console.log(`[Health Check] Provider ${provider} has failed 3 times. Placing in 5-minute timeout.`);
    status.timeoutUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  }
  providerHealth.set(provider, status);
}

function reportSuccess(provider: ProviderType) {
  if (providerHealth.has(provider)) {
    providerHealth.get(provider)!.failureCount = 0;
    providerHealth.get(provider)!.timeoutUntil = undefined;
  }
}

// --- NEW: Server Action to expose health status to the UI ---
export async function getHealthStatus(): Promise<Record<string, ProviderHealth>> {
    return Object.fromEntries(providerHealth.entries());
}

// --- Helper Functions (Updated to use health status) ---
function getAvailableProviders(excludeProviders: ProviderType[] = []): Array<{ provider: ProviderType; model: ModelName }> {
  const providers: Array<{ provider: ProviderType; model: ModelName }> = [];
  const allModelNames = Object.keys(MODEL_CONFIGS) as ModelName[];
  const potentialProviders = ['openai', 'anthropic', 'google', 'mistral', 'togetherai'] as ProviderType[];

  for (const provider of potentialProviders) {
    // ADDED: Health Check
    const health = providerHealth.get(provider);
    const isTimedOut = health?.timeoutUntil && health.timeoutUntil > new Date();
    
    const envVar = `${provider.toUpperCase()}_API_KEY`.replace('TOGETHERAI', 'TOGETHER');
    
    if (process.env[envVar] && !excludeProviders.includes(provider) && !isTimedOut) {
      providers.push(...allModelNames.filter(k => k.startsWith(`${provider}/`)).map(m => ({ provider, model: m })));
    }
  }
  return providers;
}

export async function classifyPrompt(prompt: string): Promise<PromptType> {
  const lowerPrompt = prompt.toLowerCase();
  
  if (/\b(calculate|solve|equation|math|logic|proof|theorem)\b/.test(lowerPrompt) || /[\d\+\-\*\/=]/.test(prompt)) return 'math_logic';
  if (/```|def |function |class |import |<\w+>/.test(prompt) || /\b(code|python|javascript|react|sql|debug|fix|implement)\b/.test(lowerPrompt)) return 'code_generation';
  if (/\b(summarize|tldr|brief|outline|key points|recap)\b/.test(lowerPrompt)) return 'summarization';
  if (/\b(translate|in french|in spanish|in german)\b/.test(lowerPrompt)) return 'translation';
  if (/\b(analyze|analysis|compare|contrast|evaluate|assess)\b/.test(lowerPrompt)) return 'analysis';
  if (/\b(story|poem|creative|narrative|write a scene)\b/.test(lowerPrompt)) return 'creative_writing';
  if (prompt.length > 250 || /\b(explain in detail|comprehensive|thorough|elaborate)\b/.test(lowerPrompt)) return 'qa_complex';
  if (/\?|what is|how to|who was|why does/.test(lowerPrompt)) return 'qa_simple';
  
  return 'general_chat';
}

function calculateActualCost(modelName: ModelName, usage: { prompt_tokens: number; completion_tokens: number }): number {
    const config = MODEL_CONFIGS[modelName];
    if (!config || !usage) return 0;
    const inputCost = (usage.prompt_tokens / 1_000_000) * config.cost.input;
    const outputCost = (usage.completion_tokens / 1_000_000) * config.cost.output;
    return inputCost + outputCost;
}

export async function routePrompt(prompt: string, priority: RoutingPriority = 'cost', excludeProviders: ProviderType[] = []): Promise<RoutingDecision> {
    const promptType = await classifyPrompt(prompt);
    const availableProviders = getAvailableProviders(excludeProviders);
    const availableModels = availableProviders.map(p => p.model);
    
    const recommendedModels = DEFAULT_ROUTING_RULES[promptType][priority];
    const selectedModelNames = recommendedModels.filter(model => availableModels.includes(model)).slice(0, 3);
    
    const selectedModels = selectedModelNames.map(modelName => ({
        provider: MODEL_CONFIGS[modelName].provider,
        model: modelName
    }));
    
    const estimatedCost = selectedModelNames.length > 0
      ? selectedModelNames.reduce((sum, modelName) => sum + calculateActualCost(modelName, { prompt_tokens: 500, completion_tokens: 150 }), 0) / selectedModelNames.length
      : 0;

    const reasoning = `Classified as ${promptType}. Optimizing for ${priority}. Selected ${selectedModels.length} models: ${selectedModelNames.join(', ')}.`;

    return { promptType, selectedModels, reasoning, estimatedCost, priority };
}

export async function logRoutingDecision(decision: RoutingDecision, actualCost?: number, latency?: number, success: boolean = true): Promise<void> {
  console.log('[Routing Analytics]', JSON.stringify({ ...decision, actualCost, latency, success }, null, 2));
}

// --- Main Function with AUTO-FALLBACK & HEALTH CHECK INTEGRATION ---
export async function getModelResponseWithRouting(
  prompt: string, 
  priority: RoutingPriority = 'cost',
  customRules?: Partial<Record<PromptType, ModelName[]>>
): Promise<ModelResponse> {
  const startTime = Date.now();
  
  if (!prompt || !prompt.trim()) return { error: 'Prompt cannot be empty.', routingDecision: {} as RoutingDecision };
  if (!process.env.NOTDIAMOND_API_KEY) return { error: 'NotDiamond API key is not configured.', routingDecision: {} as RoutingDecision };

  let excludedProviders: ProviderType[] = [];
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let routingDecision: RoutingDecision;
    try {
      routingDecision = await routePrompt(prompt, priority, excludedProviders);
      
      if (customRules?.[routingDecision.promptType]) {
        const availableProviders = getAvailableProviders(excludedProviders);
        const customModels = customRules[routingDecision.promptType]!
            .map(modelName => availableProviders.find(p => p.model === modelName))
            .filter(Boolean) as Array<{ provider: ProviderType; model: string }>;
        if (customModels.length > 0) {
            routingDecision.selectedModels = customModels;
            routingDecision.reasoning += ` Applied custom rules.`;
        }
      }

      if (routingDecision.selectedModels.length === 0) {
        const error = `No available models left after excluding [${excludedProviders.join(', ')}]. Please check API keys or billing.`;
        return { error, routingDecision };
      }

      console.log(`[Attempt ${attempt}] Routing with models:`, routingDecision.selectedModels.map(m => m.model).join(', '));

      const result = await notDiamond.create({
        messages: [{ content: prompt, role: 'user' }],
        llmProviders: routingDecision.selectedModels.map(m => ({ provider: m.provider, model: m.model.split('/')[1] || m.model })),
      });

      if (!result || 'detail' in result) throw new Error(String(result?.detail ?? 'API returned an empty or invalid response.'));
      if (!result.providers || result.providers.length === 0) throw new Error("Routing was successful, but no model provider was returned.");
      
      const latency = Date.now() - startTime;
      const modelUsed = result.providers[0];
      reportSuccess(modelUsed.provider as ProviderType); // ADDED: Report success for health check
      
      const fullModelName = Object.keys(MODEL_CONFIGS).find(
        key => key.endsWith(modelUsed.model) && key.startsWith(modelUsed.provider)
      ) as ModelName;
      
      const usage = (result as any).usage as { prompt_tokens: number; completion_tokens: number } | undefined;
      const actualCost = usage && fullModelName 
        ? calculateActualCost(fullModelName, usage) 
        : routingDecision.estimatedCost;
      
      await logRoutingDecision(routingDecision, actualCost, latency, true);
      return { content: result.content, providers: result.providers, routingDecision, actualCost, latency };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[Attempt ${attempt} Failed] Error: ${errorMessage}`);
      
      routingDecision = await routePrompt(prompt, priority, excludedProviders).catch(() => ({} as RoutingDecision));

      // ADDED: Report failure to the Health Check system
      const firstProvider = routingDecision.selectedModels?.[0]?.provider;
      if (firstProvider) {
          reportFailure(firstProvider);
      }

      const errorString = errorMessage.toLowerCase();
      const isBillingError = errorString.includes('credit') || errorString.includes('quota') || errorString.includes('billing') || errorString.includes('429');

      if (isBillingError) {
        let failedProvider: ProviderType | undefined;
        if (errorString.includes('anthropic')) failedProvider = 'anthropic';
        else if (errorString.includes('openai')) failedProvider = 'openai';
        else if (errorString.includes('google')) failedProvider = 'google';
        else if (errorString.includes('mistral')) failedProvider = 'mistral';
        else if (errorString.includes('together')) failedProvider = 'togetherai';
        else if (firstProvider) failedProvider = firstProvider;
        
        if (failedProvider && !excludedProviders.includes(failedProvider)) {
          console.log(`[Auto-Fallback] Billing error detected for ${failedProvider}. Excluding and retrying.`);
          excludedProviders.push(failedProvider);
          continue;
        }
      }
      
      await logRoutingDecision(routingDecision, undefined, Date.now() - startTime, false);
      return { error: `Routing failed: ${errorMessage}`, routingDecision };
    }
  }

  const finalRoutingDecision = await routePrompt(prompt, priority, excludedProviders);
  return { error: 'All routing attempts failed. Please check your provider billing and API keys.', routingDecision: finalRoutingDecision };
}