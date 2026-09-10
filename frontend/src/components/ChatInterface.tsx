'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ExternalLink, Loader2, Sparkles, Activity, Layers, Filter, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { api, Citation, DebugTrace } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  debug_trace?: DebugTrace;
  timestamp: string;
}

interface ChatInterfaceProps {
  agentId: string;
  agentName: string;
  welcomeMessage: string;
  primaryColor?: string;
  detectedSector?: string;
}

export default function ChatInterface({
  agentId,
  agentName,
  welcomeMessage,
  primaryColor = '#3B82F6',
  detectedSector = 'general',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, expandedTraceId]);

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.chatWithAgent(agentId, messageContent, history, debugMode);

      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        debug_trace: res.debug_trace,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
      if (res.debug_trace) {
        setExpandedTraceId(botMessageId);
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an issue generating a response. Please verify the agent index status or try asking again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[700px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header with Debug Mode Toggle */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
            style={{ backgroundColor: primaryColor }}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-sm">{agentName}</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {detectedSector} sector
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Grounded AI Online
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Debug Mode Toggle */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
              debugMode
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Inspect real-time Intent, Entity detection, Applied Filters, and Reranking scores"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Test Knowledge Retrieval</span>
            <span className={`w-1.5 h-1.5 rounded-full ${debugMode ? 'bg-white' : 'bg-slate-500'}`}></span>
          </button>

          <button
            onClick={() =>
              setMessages([
                {
                  id: 'welcome',
                  role: 'assistant',
                  content: welcomeMessage,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ])
            }
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-2 ${
              msg.role === 'user' ? 'ml-auto items-end max-w-[85%]' : 'mr-auto items-start max-w-[90%]'
            }`}
          >
            <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                  msg.role === 'user' ? 'bg-indigo-600' : 'bg-blue-600'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="space-y-2">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Citations Box */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Source Citations:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite, idx) => (
                          <a
                            key={idx}
                            href={cite.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 text-xs font-medium transition-all group"
                            title={cite.snippet}
                          >
                            <span className="truncate max-w-[200px]">{cite.title || cite.url}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div
                  className={`text-[10px] text-slate-500 px-1 ${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>

            {/* LIVE KNOWLEDGE RETRIEVAL DEBUG ACCORDION */}
            {msg.debug_trace && (
              <div className="w-full bg-slate-950 border border-purple-500/30 rounded-xl overflow-hidden shadow-lg mt-1">
                <button
                  onClick={() =>
                    setExpandedTraceId(expandedTraceId === msg.id ? null : msg.id)
                  }
                  className="w-full px-4 py-2.5 bg-purple-950/30 border-b border-purple-500/20 flex items-center justify-between text-xs text-purple-300 font-semibold hover:bg-purple-950/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span>Knowledge Retrieval Pipeline Trace</span>
                    <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[10px] font-mono">
                      Intent: {msg.debug_trace.detected_intent}
                    </span>
                  </div>
                  {expandedTraceId === msg.id ? (
                    <ChevronUp className="w-4 h-4 text-purple-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-purple-400" />
                  )}
                </button>

                {expandedTraceId === msg.id && (
                  <div className="p-4 space-y-3 text-xs text-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-slate-800">
                      <div>
                        <span className="text-slate-500 font-medium block">Detected Intent:</span>
                        <span className="text-blue-400 font-mono font-bold">
                          {msg.debug_trace.detected_intent}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Detected Entity:</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {msg.debug_trace.detected_entity || msg.debug_trace.detected_entity_type || 'None'}
                        </span>
                      </div>
                    </div>

                    {msg.debug_trace.matched_structured_entities.length > 0 && (
                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">
                          Matched Structured Records:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.debug_trace.matched_structured_entities.map((ent, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-mono"
                            >
                              {ent}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-slate-400 font-semibold block mb-2">
                        Reranked Chunks & Similarity Scores:
                      </span>
                      <div className="space-y-2">
                        {msg.debug_trace.reranked_chunks.map((chk, i) => (
                          <div
                            key={i}
                            className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-200 font-medium truncate max-w-[280px]">
                                {chk.title}
                              </span>
                              <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Match Score: {(chk.score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                              {chk.snippet}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 mr-auto max-w-[80%]">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-sm flex items-center gap-2 rounded-tl-none">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Searching knowledge base & ranking candidates...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask a question about the website content..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
