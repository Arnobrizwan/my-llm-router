'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, BarChart3, Clock, DollarSign, Star, Brain, Zap, Bot, User, Trash2, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { getModelResponseWithRouting, getHealthStatus } from '@/app/actions/llmActions';
import { MODEL_CONFIGS, DEFAULT_ROUTING_RULES } from '@/lib/models';
import type { ModelName, PromptType, RoutingPriority, RoutingDecision, ModelResponse, Message, DetailedFeedback, AnalyticsData, ProviderHealth } from '@/lib/models';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// NEW: Simplified approach - calculate savings based on model differences
const calculateSavingsForResponse = (response: ModelResponse): number => {
  if (!response.routingDecision || !response.providers?.[0] || !response.actualCost) {
    return 0;
  }

  // Get the actual model used
  const actualModelKey = `${response.providers[0].provider}/${response.providers[0].model}` as ModelName;
  const actualModelConfig = MODEL_CONFIGS[actualModelKey];
  
  // Use the most expensive model as our baseline for comparison
  const expensiveModels: ModelName[] = [
    'openai/gpt-4-turbo-preview',
    'anthropic/claude-3-opus-20240229', 
    'openai/gpt-4o'
  ];
  
  let maxBaselineCost = 0;
  let baselineConfig = null;
  
  // Find the most expensive available baseline
  for (const modelKey of expensiveModels) {
    const config = MODEL_CONFIGS[modelKey];
    if (config) {
      const avgCost = (config.cost.input + config.cost.output) / 2;
      if (avgCost > maxBaselineCost) {
        maxBaselineCost = avgCost;
        baselineConfig = config;
      }
    }
  }
  
  if (!actualModelConfig || !baselineConfig) {
    console.log('Model config not found:', { actualModelKey, hasBaseline: !!baselineConfig });
    return 0;
  }
  
  // Calculate cost multiplier difference
  const actualAvgCost = (actualModelConfig.cost.input + actualModelConfig.cost.output) / 2;
  const baselineAvgCost = (baselineConfig.cost.input + baselineConfig.cost.output) / 2;
  
  // If we used a cheaper model, calculate the savings
  if (actualAvgCost < baselineAvgCost) {
    const costRatio = baselineAvgCost / actualAvgCost;
    const potentialCost = response.actualCost * costRatio;
    const savings = potentialCost - response.actualCost;
    
    console.log('💰 Savings calculation:', {
      actualModel: actualModelKey,
      actualCost: response.actualCost,
      actualAvgCostPer1M: actualAvgCost,
      baselineAvgCostPer1M: baselineAvgCost,
      costRatio: costRatio,
      potentialCost: potentialCost,
      savings: savings
    });
    
    return savings;
  }
  
  return 0;
};

// --- Main Page Component ---
export default function HomePage() {
  const [inputPrompt, setInputPrompt] = useState('');
  const [priority, setPriority] = useState<RoutingPriority>('cost');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [customRules, setCustomRules] = useState<Partial<Record<PromptType, ModelName[]>>>({});
  const [feedbackLog, setFeedbackLog] = useState<Record<number, 'good' | 'bad'>>({});
  const [detailedFeedbackLog, setDetailedFeedbackLog] = useState<DetailedFeedback[]>([]);
  const [healthStatus, setHealthStatus] = useState<Record<string, ProviderHealth>>({});
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRequests: 0, averageCost: 0, averageLatency: 0, costSavings: 0,
    promptTypeDistribution: {} as Record<PromptType, number>,
    feedback: { good: 0, bad: 0 },
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const lastUserMessage = [...messages].reverse().find(m => m.sender === 'user');
    if (lastUserMessage && !loading) {
      handleRequest(lastUserMessage.text, true);
    }
  }, [priority]);

  // UPDATED: Analytics calculation with new savings logic
  useEffect(() => {
    const validResponses = messages.filter(m => 
      m.sender === 'bot' && 
      m.responseDetails && 
      !m.responseDetails.error &&
      m.responseDetails.actualCost && 
      m.responseDetails.actualCost > 0
    );
    
    console.log('Valid responses for analytics:', validResponses.length);
    
    if (validResponses.length === 0) {
      setAnalytics({ 
        totalRequests: 0, 
        averageCost: 0, 
        averageLatency: 0, 
        costSavings: 0, 
        promptTypeDistribution: {} as Record<PromptType, number>, 
        feedback: { good: 0, bad: 0 } 
      });
      return;
    }

    const totalActualCost = validResponses.reduce((sum, msg) => sum + (msg.responseDetails?.actualCost || 0), 0);
    
    // Calculate total savings using the new method
    const totalSavings = validResponses.reduce((sum, msg) => {
      return sum + calculateSavingsForResponse(msg.responseDetails!);
    }, 0);

    const totalLatency = validResponses.reduce((sum, msg) => sum + (msg.responseDetails?.latency || 0), 0);
    
    const distribution = validResponses.reduce((acc, msg) => {
      const type = msg.responseDetails!.routingDecision.promptType;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<PromptType, number>);
    
    const feedbackCounts = Object.values(feedbackLog).reduce((acc, rating) => {
      if (rating === 'good') acc.good++;
      if (rating === 'bad') acc.bad++;
      return acc;
    }, { good: 0, bad: 0 });

    console.log('📊 Final analytics calculation:', {
      totalResponses: validResponses.length,
      totalActualCost,
      totalSavings,
      avgCost: totalActualCost / validResponses.length
    });

    setAnalytics({
      totalRequests: validResponses.length,
      averageCost: totalActualCost / validResponses.length,
      averageLatency: totalLatency / validResponses.length,
      costSavings: totalSavings,
      promptTypeDistribution: distribution,
      feedback: feedbackCounts,
    });
  }, [messages, feedbackLog]);

  const updateHealthStatus = async () => {
    const status = await getHealthStatus();
    setHealthStatus(status);
  };

  const handleRequest = async (promptText: string, isReroute: boolean = false) => {
    setLoading(true);
    if (!isReroute) {
      const userMessage: Message = { id: Date.now(), sender: 'user', text: promptText };
      setMessages(prev => [...prev, userMessage]);
      setInputPrompt('');
    }
    try {
      const activeCustomRules = Object.fromEntries(
        Object.entries(customRules).filter(([, models]) => models && models.length > 0)
      );
      const result = await getModelResponseWithRouting(promptText, priority, activeCustomRules);
      const botMessage: Message = {
        id: Date.now() + 1, sender: 'bot',
        text: result.error || result.content || "Sorry, I couldn't get a response.",
        responseDetails: result,
      };
      setMessages(prev => {
        const newMessages = [...prev];
        if (isReroute && newMessages.length > 0 && newMessages[newMessages.length - 1].sender === 'bot') {
          newMessages[newMessages.length - 1] = botMessage;
        } else { newMessages.push(botMessage); }
        return newMessages;
      });
      setSelectedMessage(botMessage);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now() + 1, sender: 'bot', text: 'An unexpected error occurred.',
        responseDetails: { error: 'Failed to communicate with server', routingDecision: {} as RoutingDecision },
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally { 
        setLoading(false);
        updateHealthStatus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || loading) return;
    handleRequest(inputPrompt);
  };
  
  const handleClearChat = () => {
    setMessages([]);
    setSelectedMessage(null);
    setFeedbackLog({});
    setDetailedFeedbackLog([]);
  };

  const handleFeedback = (messageId: number, rating: 'good' | 'bad') => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    const message = messages[messageIndex];

    if (message?.responseDetails && !message.responseDetails.error && messageIndex > 0) {
      const userPrompt = messages[messageIndex - 1].text;
      const feedbackData: DetailedFeedback = {
        rating: rating,
        promptType: message.responseDetails.routingDecision.promptType,
        modelUsed: message.responseDetails.providers?.[0]?.model || 'N/A',
        provider: message.responseDetails.providers?.[0]?.provider || 'N/A',
        prompt: userPrompt,
      };
      setDetailedFeedbackLog(prev => [...prev, feedbackData]);
      console.log('Detailed Feedback Logged:', feedbackData);
    }
    setFeedbackLog(prev => ({ ...prev, [messageId]: rating }));
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-gray-200 font-sans">
      <Sidebar priority={priority} setPriority={setPriority} onClearChat={handleClearChat} />
      <main className="flex flex-col flex-1 h-screen">
        <ChatHeader />
        <ChatMessages messages={messages} loading={loading} onMessageSelect={setSelectedMessage} onFeedback={handleFeedback} chatEndRef={chatEndRef} feedbackLog={feedbackLog} />
        <ChatInput 
          prompt={inputPrompt} setPrompt={setInputPrompt} loading={loading} onSubmit={handleSubmit}
          setShowSettings={setShowSettings} setShowAnalytics={setShowAnalytics}
        />
      </main>
      <DetailsPanel 
        selectedMessage={selectedMessage} showSettings={showSettings} setShowSettings={setShowSettings}
        showAnalytics={showAnalytics} setShowAnalytics={setShowAnalytics} customRules={customRules}
        setCustomRules={setCustomRules} analytics={analytics} detailedFeedback={detailedFeedbackLog}
        healthStatus={healthStatus}
      />
    </div>
  );
}

// --- Sub-components ---

function Sidebar({ priority, setPriority, onClearChat }: { priority: RoutingPriority, setPriority: (p: RoutingPriority) => void, onClearChat: () => void }) {
  const getPriorityIcon = (p: RoutingPriority) => {
    if (p === 'cost') return <DollarSign className="w-5 h-5" />;
    if (p === 'latency') return <Zap className="w-5 h-5" />;
    if (p === 'quality') return <Star className="w-5 h-5" />;
  };
  return (
    <aside className="w-80 h-full bg-slate-950/50 border-r border-slate-800 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg"><Brain className="w-6 h-6 text-white" /></div>
        <h1 className="text-2xl font-bold text-white">AI Router</h1>
      </div>
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Optimization Priority</h2>
        <div className="flex flex-col gap-2">
          {(['cost', 'latency', 'quality'] as RoutingPriority[]).map((p) => (
            <button key={p} onClick={() => setPriority(p)} className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-left ${priority === p ? `bg-${p === 'cost' ? 'green' : p === 'latency' ? 'blue' : 'purple'}-500 text-white shadow-md` : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'}`}>
              {getPriorityIcon(p)}<span className="capitalize font-medium">{p}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto">
        <button onClick={onClearChat} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-800/20 hover:bg-red-800/50 text-red-400 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" /><span>Clear Chat</span>
        </button>
      </div>
    </aside>
  );
}

function ChatHeader() {
  return <header className="flex-shrink-0 h-16 bg-slate-900/50 border-b border-slate-800 flex items-center px-6"><h2 className="font-semibold text-lg text-white">Conversation</h2></header>;
}

function ChatMessages({ messages, loading, onMessageSelect, onFeedback, chatEndRef, feedbackLog }: { messages: Message[], loading: boolean, onMessageSelect: (msg: Message) => void, onFeedback: (id: number, rating: 'good' | 'bad') => void, chatEndRef: React.RefObject<HTMLDivElement>, feedbackLog: Record<number, 'good' | 'bad'> }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-6">
        {messages.map((msg) => (<ChatMessage key={msg.id} message={msg} onMessageSelect={onMessageSelect} onFeedback={onFeedback} feedback={feedbackLog[msg.id]} />))}
        {loading && <LoadingIndicator />}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

function ChatMessage({ message, onMessageSelect, onFeedback, feedback }: { message: Message, onMessageSelect: (msg: Message) => void, onFeedback: (id: number, rating: 'good' | 'bad') => void, feedback?: 'good' | 'bad' }) {
  const isUser = message.sender === 'user';
  const Icon = isUser ? User : Bot;
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts = message.text.split(codeBlockRegex);

  return (
    <div className={`group flex gap-4 items-start ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center"><Icon className="w-5 h-5 text-white" /></div>}
      <div className={`flex flex-col items-start max-w-xl`}>
        <div className={`p-4 rounded-lg shadow-md ${isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-gray-200 rounded-bl-none'}`}>
          <div className="prose prose-invert prose-sm max-w-none">
            {parts.map((part, index) => {
              if (index % 3 === 2) {
                const language = parts[index - 1] || 'bash';
                return (
                  <div key={index} className="my-2 bg-slate-900 rounded-md overflow-hidden border border-slate-700">
                    <div className="flex justify-between items-center px-4 py-1 bg-slate-950/50"><span className="text-xs text-gray-400">{language}</span></div>
                    <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem' }}>{part.trim()}</SyntaxHighlighter>
                  </div>
                );
              }
              if (index % 3 === 0) return <p key={index} className="m-0" dangerouslySetInnerHTML={{ __html: part.replace(/\n/g, '<br />') }} />;
              return null;
            })}
          </div>
        </div>
        {!isUser && (
          <div className="flex items-center gap-2 mt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="p-1.5 text-gray-500 hover:text-white hover:bg-slate-700 rounded-full transition-colors">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</button>
            <button onClick={() => onMessageSelect(message)} className="p-1.5 text-gray-500 hover:text-white hover:bg-slate-700 rounded-full transition-colors"><Settings className="w-4 h-4" /></button>
            <button onClick={() => onFeedback(message.id, 'good')} className={`p-1.5 rounded-full transition-colors ${feedback === 'good' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-green-400 hover:bg-slate-700'}`}><ThumbsUp className="w-4 h-4" /></button>
            <button onClick={() => onFeedback(message.id, 'bad')} className={`p-1.5 rounded-full transition-colors ${feedback === 'bad' ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-red-400 hover:bg-slate-700'}`}><ThumbsDown className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      {isUser && <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center"><Icon className="w-5 h-5 text-white" /></div>}
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center"><Bot className="w-5 h-5 text-white" /></div>
      <div className="p-4 bg-slate-800 rounded-lg rounded-bl-none"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div></div></div>
    </div>
  );
}

function ChatInput({ prompt, setPrompt, loading, onSubmit, setShowSettings, setShowAnalytics }: { prompt: string, setPrompt: (p: string) => void, loading: boolean, onSubmit: (e: React.FormEvent) => void, setShowSettings: (cb: (s: boolean) => boolean) => void, setShowAnalytics: (cb: (s: boolean) => boolean) => void }) {
  return (
    <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900">
      <div className="flex gap-3 mb-3">
        <button onClick={() => {setShowSettings(s => !s); setShowAnalytics(false);}} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-gray-300 rounded-lg text-xs transition-colors"><Settings className="w-4 h-4" /> Custom Rules</button>
        <button onClick={() => {setShowAnalytics(s => !s); setShowSettings(false);}} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-gray-300 rounded-lg text-xs transition-colors"><BarChart3 className="w-4 h-4" /> Analytics</button>
      </div>
      <form onSubmit={onSubmit} className="relative">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }} placeholder="Ask the AI Router anything..." className="w-full p-4 pr-16 bg-slate-800 border border-slate-700 rounded-xl text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={1} disabled={loading} />
        <button type="submit" disabled={loading || !prompt.trim()} className="absolute bottom-3 right-3 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"><Send className="w-5 h-5 text-white" /></button>
      </form>
    </div>
  );
}

function DetailsPanel({ selectedMessage, showSettings, showAnalytics, customRules, setCustomRules, analytics, detailedFeedback, healthStatus, setShowAnalytics, setShowSettings }: { selectedMessage: Message | null, showSettings: boolean, setShowSettings: (s: boolean) => void, showAnalytics: boolean, setShowAnalytics: (s: boolean) => void, customRules: Partial<Record<PromptType, ModelName[]>>, setCustomRules: (rules: Partial<Record<PromptType, ModelName[]>>) => void, analytics: AnalyticsData, detailedFeedback: DetailedFeedback[], healthStatus: Record<string, ProviderHealth> }) {
  const getPromptTypeColor = (type?: PromptType) => {
    const colors: Record<PromptType, string> = {
      summarization: 'bg-blue-900 text-blue-300', code_generation: 'bg-green-900 text-green-300',
      qa_simple: 'bg-yellow-900 text-yellow-300', qa_complex: 'bg-orange-900 text-orange-300',
      creative_writing: 'bg-purple-900 text-purple-300', analysis: 'bg-red-900 text-red-300',
      translation: 'bg-indigo-900 text-indigo-300', math_logic: 'bg-pink-900 text-pink-300',
      general_chat: 'bg-gray-700 text-gray-300'
    };
    return type ? colors[type] : colors.general_chat;
  };

  return (
    <aside className="w-96 h-full bg-slate-950/50 border-l border-slate-800 p-6 overflow-y-auto flex flex-col gap-6">
      {showAnalytics && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Analytics</h2>
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-sm space-y-3">
            <div><h3 className="text-gray-400 font-semibold mb-2">Performance Metrics</h3><div className="space-y-2"><div className="flex justify-between"><span>Avg Cost / Req:</span> <span className="font-medium text-green-400">${analytics.averageCost.toFixed(5)}</span></div><div className="flex justify-between"><span>Avg Latency:</span> <span className="font-medium text-blue-400">{analytics.averageLatency.toFixed(0)}ms</span></div><div className="flex justify-between"><span>Total Savings:</span> <span className="font-medium text-green-400">${analytics.costSavings.toFixed(5)}</span></div></div></div>
            <div><h3 className="text-gray-400 font-semibold mb-2 pt-3 border-t border-slate-700">User Feedback</h3><div className="space-y-2"><div className="flex justify-between"><span>👍 Good:</span> <span className="font-medium text-green-400">{analytics.feedback.good}</span></div><div className="flex justify-between"><span>👎 Bad:</span> <span className="font-medium text-red-400">{analytics.feedback.bad}</span></div></div></div>
            <div><h3 className="text-gray-400 font-semibold mb-2 pt-3 border-t border-slate-700">Prompt Distribution</h3><div className="space-y-1">{Object.keys(analytics.promptTypeDistribution).length > 0 ? Object.entries(analytics.promptTypeDistribution).map(([type, count]) => (<div key={type} className="flex justify-between text-xs"><span className="capitalize text-gray-300">{type.replace(/_/g, ' ')}</span><span>{count}</span></div>)) : <p className='text-xs text-gray-500'>No data yet.</p>}</div></div>
            <div>
              <h3 className="text-gray-400 font-semibold mb-2 pt-3 border-t border-slate-700">Detailed Feedback Log</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detailedFeedback.length > 0 ? detailedFeedback.map((fb, i) => (
                  <div key={i} className="text-xs p-2 bg-slate-900/50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-300">{fb.promptType.replace(/_/g, ' ')}</span>
                      {fb.rating === 'good' ? <ThumbsUp className="w-4 h-4 text-green-400" /> : <ThumbsDown className="w-4 h-4 text-red-400" />}
                    </div>
                    <p className="text-gray-400 truncate">"{fb.prompt}"</p>
                    <p className="text-xs text-blue-400">{fb.modelUsed}</p>
                  </div>
                )) : <p className='text-xs text-gray-500'>No feedback yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Custom Routing Rules</h2>
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-4">
            <p className="text-xs text-gray-500">Force specific models for a prompt type. Leave blank to use default rules.</p>
            {Object.keys(DEFAULT_ROUTING_RULES).map((type) => (
              <div key={type} className="text-sm">
                <label className={`capitalize text-gray-300 mb-1 block text-xs font-medium`}>{type.replace(/_/g, ' ')}</label>
                <input
                  type="text"
                  placeholder="e.g., openai/gpt-4o"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={(customRules[type as PromptType] || []).join(', ')}
                  onChange={(e) => {
                    const newModels = e.target.value.split(',').map(m => m.trim()).filter(Boolean) as ModelName[];
                    setCustomRules(prev => ({ ...prev, [type]: newModels }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!showAnalytics && !showSettings && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Request Details</h2>
          {selectedMessage?.responseDetails ? (
            <div className="flex flex-col gap-6 text-sm animate-fade-in">
              {selectedMessage.responseDetails.error ? (
                <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400">
                  <h3 className="font-semibold mb-2">Error</h3><p>{selectedMessage.responseDetails.error}</p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-gray-400 font-semibold mb-2">Routing Decision</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPromptTypeColor(selectedMessage.responseDetails.routingDecision?.promptType)}`}>{selectedMessage.responseDetails.routingDecision?.promptType?.replace(/_/g, ' ') || 'N/A'}</span>
                        <span className="text-gray-400 capitalize">{selectedMessage.responseDetails.routingDecision?.priority} Priority</span>
                      </div>
                      <p className="text-gray-400 italic">"{selectedMessage.responseDetails.routingDecision?.reasoning}"</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-gray-400 font-semibold mb-2">Performance</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 flex justify-around text-center">
                      <div><div className="font-bold text-lg text-green-400">${(selectedMessage.responseDetails.actualCost || 0).toFixed(5)}</div><div className="text-xs text-gray-400">Actual Cost</div></div>
                      <div><div className="font-bold text-lg text-blue-400">{selectedMessage.responseDetails.latency || 0}ms</div><div className="text-xs text-gray-400">Latency</div></div>
                      <div>
                        <div className="font-bold text-lg text-purple-400">
                          {(selectedMessage.responseDetails.providers && selectedMessage.responseDetails.providers.length > 0 && selectedMessage.responseDetails.providers[0].model)
                            ? (MODEL_CONFIGS[`${selectedMessage.responseDetails.providers[0].provider}/${selectedMessage.responseDetails.providers[0].model}` as ModelName]?.quality || 0)
                            : 0}/10
                        </div>
                        <div className="text-xs text-gray-400">Quality Score</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-gray-400 font-semibold mb-2">Model Used</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <p className="font-semibold text-blue-400">{selectedMessage.responseDetails.providers?.map(p => p.model).join(', ')}</p>
                      <p className="text-xs text-gray-400 capitalize">{selectedMessage.responseDetails.providers?.map(p => p.provider).join(', ')}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-gray-400 font-semibold mb-2">Provider Health Status</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                      {Object.keys(healthStatus).length > 0 ? Object.entries(healthStatus).map(([provider, status]) => (
                        <div key={provider} className="flex justify-between items-center text-xs">
                          <span className="capitalize text-gray-300">{provider}</span>
                          {status.timeoutUntil && new Date(status.timeoutUntil) > new Date() ? (
                            <span className="font-medium text-red-400">In Timeout</span>
                          ) : (
                            <span className="font-medium text-green-400">Healthy</span>
                          )}
                          <span className="text-gray-500">Fails: {status.failureCount}</span>
                        </div>
                      )) : <p className="text-xs text-gray-500">No health data yet. Send a request to populate.</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 pt-16"><p>Select a response to see its routing details.</p></div>
          )}
        </div>
      )}
    </aside>
  );
}