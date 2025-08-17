import 'dotenv/config';

import { routePrompt, classifyPrompt, ModelResponse, RoutingPriority } from './src/app/actions/llmActions';

// --- 1. Define the Evaluation Dataset ---
// In a real-world scenario, this would be a large set of real user prompts.
const evaluationSet = [
  { id: 'sum_01', prompt: 'Summarize the key points of the 2024 Paris Olympics opening ceremony.', expectedType: 'summarization' },
  { id: 'code_01', prompt: 'Write a TypeScript function to fetch data from an API and handle errors.', expectedType: 'code_generation' },
  { id: 'qa_c_01', prompt: 'Explain in detail the theory of general relativity and its implications for black holes.', expectedType: 'qa_complex' },
  { id: 'math_01', prompt: 'What is the integral of x^2 * sin(x) dx?', expectedType: 'math_logic' },
  { id: 'creative_01', prompt: 'Write a short story about a robot who discovers music.', expectedType: 'creative_writing' },
  { id: 'qa_s_01', prompt: 'What is the capital of Bangladesh?', expectedType: 'qa_simple' },
];

// --- 2. Mock API Responses ---
// This simulates what the NotDiamond API might return for a given model.
// We'll mock the cost and latency to measure the effectiveness of our routing.
async function mockApiCall(model: { provider: string; model: string }): Promise<{ cost: number; latency: number }> {
  // Simulate network delay
  await new Promise(res => setTimeout(res, Math.random() * 500 + 100));
  
  // Mock performance based on model type (a real evaluation would use real data)
  if (model.model.includes('haiku') || model.model.includes('flash')) {
    return { cost: 0.0005, latency: 300 }; // Cheap and fast
  }
  if (model.model.includes('sonnet') || model.model.includes('gpt-4o')) {
    return { cost: 0.005, latency: 1200 }; // Medium cost and speed
  }
  if (model.model.includes('opus') || model.model.includes('gpt-4-turbo')) {
    return { cost: 0.015, latency: 2500 }; // Expensive and slow
  }
  return { cost: 0.002, latency: 800 }; // Default
}

// --- 3. The Main Evaluation Function ---
async function runEvaluation() {
  console.log('🚀 Starting LLM Router Evaluation...\n');
  
  const priorities: RoutingPriority[] = ['cost', 'latency', 'quality'];
  const results: any[] = [];

  for (const item of evaluationSet) {
    for (const priority of priorities) {
      console.log(`--- Running test [${item.id}] for priority [${priority}] ---`);
      
      // Step A: Get the routing decision from your function
      const decision = await routePrompt(item.prompt, priority);
      
      // Step B: Simulate calling the first model chosen by the router
      const chosenModel = decision.selectedModels[0];
      const performance = await mockApiCall(chosenModel);
      
      // Step C: Check if the classification was correct
      const actualType = await classifyPrompt(item.prompt);
      const classificationCorrect = actualType === item.expectedType;
      
      results.push({
        ...item,
        priority,
        chosenModel: `${chosenModel.provider}/${chosenModel.model}`,
        ...performance,
        classificationCorrect,
      });

      console.log(`Prompt: "${item.prompt.substring(0, 30)}..."`);
      console.log(`Classification: ${actualType} (Correct: ${classificationCorrect})`);
      console.log(`Chosen Model: ${chosenModel.provider}/${chosenModel.model}`);
      console.log(`Simulated Cost: $${performance.cost.toFixed(4)}`);
      console.log(`Simulated Latency: ${performance.latency}ms\n`);
    }
  }

  // --- 4. Analyze and Print the Report ---
  console.log('--- ✅ Evaluation Complete ---');
  console.log('\n📊 Performance Report:\n');

  // Overall Metrics
  const totalTests = results.length;
  const correctClassifications = results.filter(r => r.classificationCorrect).length;
  const classificationAccuracy = (correctClassifications / totalTests) * 100;
  
  console.log(`Classification Accuracy: ${classificationAccuracy.toFixed(2)}% (${correctClassifications}/${totalTests})`);

  // Per-Priority Analysis
  for (const priority of priorities) {
    const priorityResults = results.filter(r => r.priority === priority);
    const avgCost = priorityResults.reduce((sum, r) => sum + r.cost, 0) / priorityResults.length;
    const avgLatency = priorityResults.reduce((sum, r) => sum + r.latency, 0) / priorityResults.length;

    console.log(`\nPriority: ${priority.toUpperCase()}`);
    console.log(`  - Average Cost: $${avgCost.toFixed(5)}`);
    console.log(`  - Average Latency: ${avgLatency.toFixed(0)}ms`);
  }
}

// --- Run the script ---
runEvaluation();