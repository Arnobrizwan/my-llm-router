// src/app/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Send, Settings, BarChart3, Clock, DollarSign, Star, Brain, Zap, Target } from 'lucide-react';
import { getModelResponseWithRouting } from '@/app/actions/llmActions';

// --- Type Definitions ---
type PromptType =
  | 'summarization'
  | 'code_generation'
  | 'qa_simple'
  | 'qa_complex'
  | 'creative_writing'
  | 'analysis'
  | 'translation'
  | 'math_logic'
  | 'general_chat';

type RoutingPriority = 'cost' | 'latency' | 'quality';

interface RoutingDecision {
  promptType: PromptType;
  selectedModels: Array<{ provider: string; model: string }>;
  reasoning: string;
  estimatedCost: number;
  priority: RoutingPriority;
}

interface ModelResponse {
  content?: string;
  providers?: { model: string; provider: string; }[];
  routingDecision: RoutingDecision;
  actualCost?: number;
  latency?: number;
  error?: string;
}

interface AnalyticsData {
  totalRequests: number;
  averageCost: number;
  averageLatency: number;
  mostUsedModel: string;
  costSavings: number;
  promptTypeDistribution: Record<PromptType, number>;
}


// --- Main Page Component ---
export default function HomePage() {
  const [prompt, setPrompt] = useState('');
  const [priority, setPriority] = useState<RoutingPriority>('cost');
  const [response, setResponse] = useState<ModelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [history, setHistory] = useState<ModelResponse[]>([]);
  const [customRules, setCustomRules] = useState<Record<PromptType, string[]>>({
    summarization: [], code_generation: [], qa_simple: [], qa_complex: [],
    creative_writing: [], analysis: [], translation: [], math_logic: [], general_chat: []
  });

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRequests: 0, averageCost: 0, averageLatency: 0, mostUsedModel: 'N/A',
    costSavings: 0, promptTypeDistribution: {
      summarization: 0, code_generation: 0, qa_simple: 0, qa_complex: 0,
      creative_writing: 0, analysis: 0, translation: 0, math_logic: 0, general_chat: 0
    }
  });

  // Update analytics when history changes
  useEffect(() => {
    if (history.length > 0) {
      const validResponses = history.filter(h => h.actualCost != null && h.latency != null);
      if (validResponses.length === 0) return;

      const avgCost = validResponses.reduce((sum, h) => sum + (h.actualCost || 0), 0) / validResponses.length;
      const avgLatency = validResponses.reduce((sum, h) => sum + (h.latency || 0), 0) / validResponses.length;
      
      const distribution = { ...analytics.promptTypeDistribution };
      history.forEach(h => {
        if (h.routingDecision?.promptType) {
          distribution[h.routingDecision.promptType] = (distribution[h.routingDecision.promptType] || 0) + 1;
        }
      });

      setAnalytics({
        totalRequests: history.length,
        averageCost: isNaN(avgCost) ? 0 : avgCost,
        averageLatency: isNaN(avgLatency) ? 0 : avgLatency,
        mostUsedModel: 'claude-3.5-sonnet', // This would be calculated in a real scenario
        costSavings: (isNaN(avgCost) ? 0 : avgCost) * 0.3 * history.length, // Mock 30% savings
        promptTypeDistribution: distribution
      });
    }
  }, [history]);

  // Re-submit the prompt when the priority changes
  useEffect(() => {
    if (prompt && response && !response.error && !loading) {
      const pseudoEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(pseudoEvent);
    }
  }, [priority]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResponse(null);

    try {
      const customRulesFormatted = Object.fromEntries(
        Object.entries(customRules).filter(([, models]) => models.length > 0)
      );

      const result = await getModelResponseWithRouting(
        prompt, 
        priority, 
        Object.keys(customRulesFormatted).length > 0 ? customRulesFormatted : undefined
      );

      setResponse(result);
      if (!result.error) {
        setHistory(prev => [result, ...prev].slice(0, 20)); // Keep last 20 history items
      }
    } catch (error) {
      console.error('Error calling server action:', error);
      setResponse({
        error: error instanceof Error ? error.message : 'Failed to communicate with server',
        routingDecision: {} as RoutingDecision
      });
    } finally {
      setLoading(false);
    }
  };
  
  // --- Helper Functions for UI ---
  const getPriorityIcon = (p: RoutingPriority) => {
    if (p === 'cost') return <DollarSign className="w-4 h-4" />;
    if (p === 'latency') return <Zap className="w-4 h-4" />;
    if (p === 'quality') return <Star className="w-4 h-4" />;
  };

  const getPriorityColor = (p: RoutingPriority) => {
    if (p === 'cost') return 'bg-green-500';
    if (p === 'latency') return 'bg-blue-500';
    if (p === 'quality') return 'bg-purple-500';
  };

  const getPromptTypeColor = (type?: PromptType) => {
    const colors: Record<PromptType, string> = {
      summarization: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      code_generation: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      qa_simple: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      qa_complex: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      creative_writing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      analysis: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      translation: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      math_logic: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      general_chat: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return type ? colors[type] : colors.general_chat;
  };
  
  // --- JSX Return ---
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">AI Model Router</h1>
          </div>
          <p className="text-gray-300 text-lg">Intelligent routing to the most cost-effective AI models</p>
          
          <div className="flex justify-center gap-4 md:gap-8 mt-6 text-sm">
            <div className="text-center"><div className="text-2xl font-bold text-blue-400">{analytics.totalRequests}</div><div className="text-gray-400">Requests</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-green-400">${analytics.costSavings.toFixed(2)}</div><div className="text-gray-400">Saved</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-purple-400">{analytics.averageLatency.toFixed(0)}ms</div><div className="text-gray-400">Avg Latency</div></div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6">
            <div className="mb-6">
              <label className="block text-white text-sm font-medium mb-3">Optimization Priority</label>
              <div className="flex flex-wrap gap-3">
                {(['cost', 'latency', 'quality'] as RoutingPriority[]).map((p) => (
                  <button key={p} onClick={() => setPriority(p)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm md:text-base ${priority === p ? `${getPriorityColor(p)} text-white shadow-lg` : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                    {getPriorityIcon(p)}
                    <span className="capitalize font-medium">{p}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mb-6">
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., 'Summarize the latest news on AI', 'Write a Python function to sort a list', 'Explain quantum computing'"
                  className="w-full p-4 pr-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button type="submit" disabled={loading || !prompt.trim()} className="absolute bottom-4 right-4 p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg transition-colors">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                </button>
              </div>
            </form>

            <div className="flex gap-3 mb-6">
              <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"><Settings className="w-4 h-4" /> Custom Rules</button>
              <button onClick={() => setShowAnalytics(!showAnalytics)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"><BarChart3 className="w-4 h-4" /> Analytics</button>
            </div>

            {/* Custom Rules Panel */}
            {showSettings && (
              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
                <h3 className="text-white font-semibold mb-3">Custom Routing Rules</h3>
                <p className="text-xs text-gray-400 mb-4">Force a specific model for a prompt type. Enter model names separated by commas (e.g., gpt-4o, claude-3-5-sonnet-20240620).</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.keys(customRules).map((type) => (
                    <div key={type} className="flex flex-col gap-2">
                      <label className={`px-2 py-1 rounded text-xs font-medium self-start ${getPromptTypeColor(type as PromptType)}`}>
                        {type.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., gpt-4o"
                        className="w-full px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={customRules[type as PromptType].join(', ')}
                        onChange={(e) => {
                          const newModels = e.target.value.split(',').map(m => m.trim()).filter(Boolean);
                          setCustomRules(prev => ({ ...prev, [type]: newModels }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analytics Panel */}
            {showAnalytics && (
              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
                <h3 className="text-white font-semibold mb-4">Usage Analytics</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-gray-300 text-sm mb-3 font-medium">Performance Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center"><span className="text-gray-400">Average Cost / Req</span><span className="text-green-400 font-medium">${analytics.averageCost.toFixed(5)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-gray-400">Average Latency</span><span className="text-blue-400 font-medium">{analytics.averageLatency.toFixed(0)}ms</span></div>
                      <div className="flex justify-between items-center"><span className="text-gray-400">Total Cost Savings</span><span className="text-green-400 font-medium">${analytics.costSavings.toFixed(2)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 text-sm mb-3 font-medium">Prompt Distribution</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(analytics.promptTypeDistribution).filter(([, count]) => count > 0).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-gray-400 capitalize">{type.replace(/_/g, ' ')}</span>
                          <span className="text-white font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Response Display Area */}
            {response && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 animate-fade-in">
                {response.error ? (
                  <div className="text-red-400 p-4 bg-red-900/20 border border-red-500/30 rounded-lg"><h3 className="font-semibold mb-2">Error</h3><p>{response.error}</p></div>
                ) : (
                  <>
                    <div className="mb-4 p-3 bg-white/10 rounded-lg border border-white/20">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-3"><span className={`px-2 py-1 rounded text-xs font-medium ${getPromptTypeColor(response.routingDecision?.promptType)}`}>{response.routingDecision?.promptType?.replace(/_/g, ' ') || 'Unknown'}</span><div className="flex items-center gap-2">{getPriorityIcon(response.routingDecision?.priority)}<span className="text-gray-300 text-sm capitalize">{response.routingDecision?.priority} Priority</span></div></div>
                        <div className="flex items-center gap-4 text-sm">
                          {response.actualCost != null && (<div className="flex items-center gap-1 text-green-400"><DollarSign className="w-3 h-3" />${response.actualCost.toFixed(5)}</div>)}
                          {response.latency != null && (<div className="flex items-center gap-1 text-blue-400"><Clock className="w-3 h-3" />{response.latency.toFixed(0)}ms</div>)}
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm italic">{response.routingDecision?.reasoning}</p>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-3">AI Response</h3>
                      <div className="bg-black/20 border border-white/10 rounded-lg p-4 prose prose-invert prose-sm max-w-none"><p className="text-gray-200 leading-relaxed">{response.content}</p></div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}