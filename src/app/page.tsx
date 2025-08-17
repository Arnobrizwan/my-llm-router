'use client';

// FIXED: Added useState, useEffect, and useRef to the import statement
import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, BarChart3, Clock, DollarSign, Star, Brain, Zap, Bot, User, Trash2, Copy, Check } from 'lucide-react';
import { getModelResponseWithRouting } from '@/app/actions/llmActions';
import { MODEL_CONFIGS, DEFAULT_ROUTING_RULES } from '@/lib/models';
import type { ModelName, PromptType, RoutingPriority, RoutingDecision, ModelResponse, Message } from '@/lib/models';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- Type Definitions ---
interface AnalyticsData {
  totalRequests: number;
  averageCost: number;
  averageLatency: number;
  costSavings: number;
  promptTypeDistribution: Record<PromptType, number>;
}

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
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRequests: 0, averageCost: 0, averageLatency: 0, costSavings: 0, 
    promptTypeDistribution: {} as Record<PromptType, number>
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Re-submit the last prompt when the priority changes
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

  // Update analytics when messages change
  useEffect(() => {
    const validResponses = messages.filter(m => m.sender === 'bot' && m.responseDetails && !m.responseDetails.error);
    if (validResponses.length === 0) {
        setAnalytics({
            totalRequests: 0, averageCost: 0, averageLatency: 0, costSavings: 0,
            promptTypeDistribution: {} as Record<PromptType, number>
        });
        return;
    };

    const totalCost = validResponses.reduce((sum, msg) => sum + (msg.responseDetails?.actualCost || 0), 0);
    const totalLatency = validResponses.reduce((sum, msg) => sum + (msg.responseDetails?.latency || 0), 0);
    const distribution = validResponses.reduce((acc, msg) => {
      const type = msg.responseDetails!.routingDecision.promptType;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<PromptType, number>);

    setAnalytics({
      totalRequests: validResponses.length,
      averageCost: totalCost / validResponses.length,
      averageLatency: totalLatency / validResponses.length,
      costSavings: totalCost * 0.3, // Mock 30% savings
      promptTypeDistribution: distribution
    });
  }, [messages]);

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
        id: Date.now() + 1,
        sender: 'bot',
        text: result.error || result.content || "Sorry, I couldn't get a response.",
        responseDetails: result,
      };
      setMessages(prev => {
        const newMessages = [...prev];
        if (isReroute && newMessages.length > 0 && newMessages[newMessages.length - 1].sender === 'bot') {
          newMessages[newMessages.length - 1] = botMessage;
        } else {
          newMessages.push(botMessage);
        }
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
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-gray-200 font-sans">
      <Sidebar priority={priority} setPriority={setPriority} onClearChat={handleClearChat} />
      <main className="flex flex-col flex-1 h-screen">
        <ChatHeader />
        <ChatMessages messages={messages} loading={loading} onMessageSelect={setSelectedMessage} chatEndRef={chatEndRef} />
        <ChatInput 
          prompt={inputPrompt} 
          setPrompt={setInputPrompt} 
          loading={loading} 
          onSubmit={handleSubmit}
          setShowSettings={setShowSettings}
          setShowAnalytics={setShowAnalytics}
        />
      </main>
      <DetailsPanel 
        selectedMessage={selectedMessage} 
        showSettings={showSettings} 
        setShowSettings={setShowSettings}
        showAnalytics={showAnalytics}
        setShowAnalytics={setShowAnalytics}
        customRules={customRules}
        setCustomRules={setCustomRules}
        analytics={analytics}
      />
    </div>
  );
}

// --- Sub-components ---
// ... (All sub-components remain the same)
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

function ChatMessages({ messages, loading, onMessageSelect, chatEndRef }: { messages: Message[], loading: boolean, onMessageSelect: (msg: Message) => void, chatEndRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-6">
        {messages.map((msg) => (<ChatMessage key={msg.id} message={msg} onMessageSelect={onMessageSelect} />))}
        {loading && <LoadingIndicator />}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

function ChatMessage({ message, onMessageSelect }: { message: Message, onMessageSelect: (msg: Message) => void }) {
  const isUser = message.sender === 'user';
  const Icon = isUser ? User : Bot;
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts = message.text.split(codeBlockRegex);

  return (
    <div className={`flex gap-4 items-start ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center"><Icon className="w-5 h-5 text-white" /></div>}
      <div className={`relative group max-w-xl p-4 rounded-lg shadow-md ${isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-gray-200 rounded-bl-none'}`}>
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
        {!isUser && (
          <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</button>
            <button onClick={() => onMessageSelect(message)} className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded"><Settings className="w-4 h-4" /></button>
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
        <button onClick={() => setShowSettings(s => !s)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-gray-300 rounded-lg text-xs transition-colors"><Settings className="w-4 h-4" /> Custom Rules</button>
        <button onClick={() => setShowAnalytics(s => !s)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-gray-300 rounded-lg text-xs transition-colors"><BarChart3 className="w-4 h-4" /> Analytics</button>
      </div>
      <form onSubmit={onSubmit} className="relative">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }} placeholder="Ask the AI Router anything..." className="w-full p-4 pr-16 bg-slate-800 border border-slate-700 rounded-xl text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={1} disabled={loading} />
        <button type="submit" disabled={loading || !prompt.trim()} className="absolute bottom-3 right-3 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"><Send className="w-5 h-5 text-white" /></button>
      </form>
    </div>
  );
}

function DetailsPanel({ selectedMessage, showSettings, showAnalytics, customRules, setCustomRules, analytics }: { selectedMessage: Message | null, showSettings: boolean, setShowSettings: (s: boolean) => void, showAnalytics: boolean, setShowAnalytics: (s: boolean) => void, customRules: Partial<Record<PromptType, ModelName[]>>, setCustomRules: (rules: Partial<Record<PromptType, ModelName[]>>) => void, analytics: AnalyticsData }) {
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
            <div><h3 className="text-gray-400 font-semibold mb-2">Performance Metrics</h3><div className="space-y-2"><div className="flex justify-between"><span>Avg Cost / Req:</span> <span className="font-medium text-green-400">${analytics.averageCost.toFixed(5)}</span></div><div className="flex justify-between"><span>Avg Latency:</span> <span className="font-medium text-blue-400">{analytics.averageLatency.toFixed(0)}ms</span></div><div className="flex justify-between"><span>Total Savings:</span> <span className="font-medium text-green-400">${analytics.costSavings.toFixed(2)}</span></div></div></div>
            <div><h3 className="text-gray-400 font-semibold mb-2 pt-3 border-t border-slate-700">Prompt Distribution</h3><div className="space-y-1">{Object.keys(analytics.promptTypeDistribution).length > 0 ? Object.entries(analytics.promptTypeDistribution).map(([type, count]) => (<div key={type} className="flex justify-between text-xs"><span className="capitalize text-gray-300">{type.replace(/_/g, ' ')}</span><span>{count}</span></div>)) : <p className='text-xs text-gray-500'>No data yet.</p>}</div></div>
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
                          {(selectedMessage.responseDetails.providers && selectedMessage.responseDetails.providers.length > 0)
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