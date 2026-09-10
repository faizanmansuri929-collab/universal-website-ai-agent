'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Send, Bot, User, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { url: string; title: string; snippet: string }[];
}

export default function WidgetPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [config, setConfig] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentId) return;
    axios.get(`/api/agents/${agentId}/widget-config`)
      .then(res => {
        setConfig(res.data);
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: res.data.welcome_message || 'Hello! How can I help you today with information from this website?'
          }
        ]);
      })
      .catch(err => console.error('Failed to load widget config:', err));
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await axios.post(`/api/agents/${agentId}/chat`, { message: text, history });

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.answer,
        citations: res.data.citations
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I am having trouble answering right now.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="h-full w-full bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const primaryColor = config.primary_color || '#3B82F6';

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 text-sm font-sans select-none">
      {/* Widget Top Header */}
      <div
        className="p-3.5 flex items-center justify-between text-white shadow-md shrink-0"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-xs leading-tight">{config.name}</div>
            <div className="text-[10px] text-white/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Verified Website Bot
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-900/60">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
          >
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-xs shrink-0 ${
                msg.role === 'user' ? 'bg-indigo-600' : 'bg-blue-600'
              }`}
            >
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div
              className={`p-3 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" /> Sources:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-blue-400 hover:underline text-[10px] truncate max-w-[150px]"
                      >
                        {c.title || 'Source'} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 mr-auto max-w-[85%]">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2 rounded-tl-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2.5 bg-slate-950 border-t border-slate-800 shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            placeholder="Type your question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{ backgroundColor: primaryColor }}
            className="w-8 h-8 rounded-lg text-white flex items-center justify-center shadow transition-all disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
