import React, { useState, useEffect } from 'react';
import { Send, Settings, BarChart3, Clock, DollarSign, Star, Brain, Zap, Target } from 'lucide-react';
import { getModelResponseWithRouting } from '@/app/actions/llmActions';

// Types
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
  providers?: string[];
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

export default function AIModelRoutingApp() {
  const [prompt, setPrompt] = useState('');
  const [priority, setPriority] = useState<RoutingPriority>('cost');
  const [response, setResponse] = useState<ModelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [history, setHistory] = useState<ModelResponse[]>([]);
  const [customRules, setCustomRules] = useState<Record<PromptType, string[]>>({
    summarization: [],
    code_generation: [],
    qa_simple: [],
    qa_complex: [],
    creative_writing: [],
    analysis: [],
    translation: [],
    math_logic: [],
    general_chat: []
  });

  // Mock analytics data (in real app, this would come from your backend)
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRequests: history.length,
    averageCost: 0,
    averageLatency: 0,
    mostUsedModel: 'claude-3-5-haiku-20241022',
    costSavings: 0,
    promptTypeDistribution: {
      summarization: 0,
      code_generation: 0,
      qa_simple: 0,
      qa_complex: 0,
      creative_writing: 0,
      analysis: 0,
      translation: 0,
      math_logic: 0,
      general_chat: 0
    }
  });

  // Update analytics when history changes
  useEffect(() => {
    if (history.length > 0) {
      const validResponses = history.filter(h => h.actualCost && h.latency);
      const avgCost = validResponses.reduce((sum, h) => sum + (h.actualCost || 0), 0) / validResponses.length;
      const avgLatency = validResponses.reduce((sum, h) => sum + (h.latency || 0), 0) / validResponses.length;
      
      const distribution: Record<PromptType, number> = {
        summarization: 0, code_generation: 0, qa_simple: 0, qa_complex: 0,
        creative_writing: 0, analysis: 0, translation: 0, math_logic: 0, general_chat: 0
      };
      
      history.forEach(h => {
        if (h.routingDecision?.promptType) {
          distribution[h.routingDecision.promptType]++;
        }
      });

      setAnalytics({
        totalRequests: history.length,
        averageCost: avgCost || 0,
        averageLatency: avgLatency || 0,
        mostUsedModel: 'claude-3-5-haiku-20241022',
        costSavings: avgCost * 0.3, // Mock 30% savings
        promptTypeDistribution: distribution
      });
    }
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      // Convert customRules to the format expected by the server action
      const customRulesFormatted = Object.fromEntries(
        Object.entries(customRules).filter(([_, models]) => models.length > 0)
      ) as Partial<Record<PromptType, string[]>>;

      // Call the actual server action
      const result = await getModelResponseWithRouting(
        prompt, 
        priority, 
        Object.keys(customRulesFormatted).length > 0 ? customRulesFormatted : undefined
      );

      setResponse(result);
      if (!result.error) {
        setHistory(prev => [result, ...prev]);
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

  const getPriorityIcon = (p: RoutingPriority) => {
    switch (p) {
      case 'cost': return <DollarSign className="w-4 h-4" />;
      case 'latency': return <Zap className="w-4 h-4" />;
      case 'quality': return <Star className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (p: RoutingPriority) => {
    switch (p) {
      case 'cost': return 'bg-green-500';
      case 'latency': return 'bg-blue-500';
      case 'quality': return 'bg-purple-500';
    }
  };

  const getPromptTypeColor = (type: PromptType) => {
    const colors = {
      summarization: 'bg-blue-100 text-blue-800',
      code_generation: 'bg-green-100 text-green-800',
      qa_simple: 'bg-yellow-100 text-yellow-800',
      qa_complex: 'bg-orange-100 text-orange-800',
      creative_writing: 'bg-purple-100 text-purple-800',
      analysis: 'bg-red-100 text-red-800',
      translation: 'bg-indigo-100 text-indigo-800',
      math_logic: 'bg-pink-100 text-pink-800',
      general_chat: 'bg-gray-100 text-gray-800'
    };
    return colors[type];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">AI Model Router</h1>
          </div>
          <p className="text-gray-300 text-lg">Intelligent routing to the most cost-effective AI models</p>
          
          {/* Stats Bar */}
          <div className="flex justify-center gap-8 mt-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{analytics.totalRequests}</div>
              <div className="text-gray-400">Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">${analytics.costSavings.toFixed(2)}</div>
              <div className="text-gray-400">Saved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{analytics.averageLatency.toFixed(0)}ms</div>
              <div className="text-gray-400">Avg Latency</div>
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6">
            {/* Priority Selection */}
            <div className="mb-6">
              <label className="block text-white text-sm font-medium mb-3">Optimization Priority</label>
              <div className="flex gap-3">
                {(['cost', 'latency', 'quality'] as RoutingPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      priority === p
                        ? `${getPriorityColor(p)} text-white shadow-lg`
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {getPriorityIcon(p)}
                    <span className="capitalize font-medium">{p}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt here... (e.g., 'Summarize this article', 'Write a Python function', 'Explain quantum computing')"
                  className="w-full p-4 pr-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="absolute bottom-4 right-4 p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </form>

            {/* Control Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Custom Rules
              </button>
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
            </div>

            {/* Custom Rules Panel */}
            {showSettings && (
              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="text-white font-semibold mb-3">Custom Routing Rules</h3>
                <div className="grid gap-3">
                  {Object.entries(customRules).map(([type, models]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPromptTypeColor(type as PromptType)}`}>
                        {type.replace('_', ' ')}
                      </span>
                      <input
                        type="text"
                        placeholder="e.g., gpt-4o, claude-3-5-sonnet-20240620"
                        className="flex-1 px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={models.join(', ')}
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
              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="text-white font-semibold mb-4">Usage Analytics</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-gray-300 text-sm mb-3">Performance Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Average Cost</span>
                        <span className="text-green-400 font-medium">${analytics.averageCost.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Average Latency</span>
                        <span className="text-blue-400 font-medium">{analytics.averageLatency.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Most Used Model</span>
                        <span className="text-purple-400 font-medium">Claude Haiku</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 text-sm mb-3">Prompt Distribution</h4>
                    <div className="space-y-1">
                      {Object.entries(analytics.promptTypeDistribution).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">{type.replace('_', ' ')}</span>
                          <span className="text-white text-sm">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Response Display */}
            {response && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                {response.error ? (
                  <div className="text-red-400">
                    <h3 className="font-semibold mb-2">Error</h3>
                    <p>{response.error}</p>
                  </div>
                ) : (
                  <>
                    {/* Routing Info */}
                    <div className="mb-4 p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPromptTypeColor(response.routingDecision?.promptType)}`}>
                            {response.routingDecision?.promptType?.replace('_', ' ') || 'Unknown'}
                          </span>
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(response.routingDecision?.priority)}
                            <span className="text-gray-300 text-sm capitalize">
                              {response.routingDecision?.priority} Priority
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {response.actualCost && (
                            <div className="flex items-center gap-1 text-green-400">
                              <DollarSign className="w-3 h-3" />
                              ${response.actualCost.toFixed(3)}
                            </div>
                          )}
                          {response.latency && (
                            <div className="flex items-center gap-1 text-blue-400">
                              <Clock className="w-3 h-3" />
                              {response.latency.toFixed(0)}ms
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm">{response.routingDecision?.reasoning}</p>
                      {response.routingDecision?.selectedModels && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {response.routingDecision.selectedModels.map((model, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                              {model.provider}:{model.model.split('-').slice(-2).join('-')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI Response */}
                    <div>
                      <h3 className="text-white font-semibold mb-3">AI Response</h3>
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <p className="text-gray-200 leading-relaxed">{response.content}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Request History */}
            {history.length > 0 && (
              <div className="mt-8">
                <h3 className="text-white font-semibold mb-4">Recent Requests</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {history.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPromptTypeColor(item.routingDecision?.promptType)}`}>
                            {item.routingDecision?.promptType?.replace('_', ' ') || 'Unknown'}
                          </span>
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(item.routingDecision?.priority)}
                            <span className="text-gray-400 text-xs capitalize">
                              {item.routingDecision?.priority}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {item.actualCost && (
                            <span className="text-green-400">${item.actualCost.toFixed(3)}</span>
                          )}
                          {item.latency && (
                            <span className="text-blue-400">{item.latency.toFixed(0)}ms</span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm line-clamp-2">
                        {item.content?.slice(0, 150)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="max-w-6xl mx-auto mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Smart Classification</h3>
            <p className="text-gray-400">
              Automatically classifies prompts into 9 categories for optimal model selection
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Priority Optimization</h3>
            <p className="text-gray-400">
              Choose between cost, latency, or quality optimization for each request
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Usage Analytics</h3>
            <p className="text-gray-400">
              Track cost savings, performance metrics, and routing decisions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}