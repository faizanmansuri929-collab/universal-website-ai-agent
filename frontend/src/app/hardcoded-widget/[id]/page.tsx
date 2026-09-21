'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Send, User, ExternalLink, Loader2, Sparkles, Zap, PhoneCall, Bot, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { api, HardcodedChatResponse, Citation } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  cta?: { label: string; url: string };
  suggested_actions?: string[];
  fallback_triggered?: boolean;
  show_ask_ai?: boolean;
  show_request_callback?: boolean;
}

export default function HardcodedWidgetPage() {
  const params = useParams();
  const botId = params.id as string;

  const [config, setConfig] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'ask_email' | 'ask_mobile' | 'active'>('ask_email');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [callbackDone, setCallbackDone] = useState(false);
  const [cbName, setCbName] = useState('');
  const [cbPhone, setCbPhone] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botId) return;
    axios.get(`/api/hardcoded-bots/${botId}/widget-config`)
      .then(res => {
        setConfig(res.data);
        const newSess = 'w_sess_' + Date.now();
        setSessionId(newSess);
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `👋 Welcome to **${res.data.name || 'Assistant'}**!\n\nBefore we get started, please enter your **email address**.`
          }
        ]);
      })
      .catch(err => console.error('Failed to load widget config:', err));
  }, [botId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setInput('');
    setLoading(true);

    try {
      const res: HardcodedChatResponse = await api.chatWithHardcodedBot(botId, text, sessionId);
      setSessionId(res.session_id);
      setCurrentStep(res.step);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        cta: res.cta,
        suggested_actions: res.suggested_actions,
        fallback_triggered: res.fallback_triggered,
        show_ask_ai: res.show_ask_ai,
        show_request_callback: res.show_request_callback
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
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  const primaryColor = config.primary_color || '#3B82F6';

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 text-sm font-sans select-none relative">
      {/* Widget Top Header */}
      <div
        className="p-3.5 flex items-center justify-between text-white shadow-md shrink-0 bg-slate-900 border-b border-slate-800"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
            <Zap className="w-4 h-4 fill-amber-400" />
          </div>
          <div>
            <div className="font-semibold text-xs leading-tight">{config.name}</div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Verified Predefined Assistant
            </div>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-900/60">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
          >
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-xs shrink-0 ${
                msg.role === 'user' ? 'bg-indigo-600' : 'bg-amber-600'
              }`}
            >
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5 fill-white" />}
            </div>

            <div
              className={`p-3 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* CTA Button */}
              {msg.cta && msg.cta.url && (
                <div className="mt-2.5 pt-2 border-t border-slate-800">
                  <a
                    href={msg.cta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] rounded-lg shadow transition-all"
                  >
                    <span>{msg.cta.label}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Fallback Action Buttons */}
              {msg.fallback_triggered && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                  {msg.show_request_callback && (
                    <button
                      onClick={() => setCallbackOpen(true)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] rounded flex items-center gap-1 shadow"
                    >
                      <PhoneCall className="w-3 h-3" /> Request Callback
                    </button>
                  )}
                </div>
              )}

              {/* Suggested Questions */}
              {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold">Suggested Questions:</div>
                  <div className="flex flex-wrap gap-1">
                    {msg.suggested_actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(act)}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 hover:text-amber-200 text-[10px] text-left"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Sources:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 hover:underline text-[10px] truncate max-w-[160px]"
                      >
                        <span>{c.url}</span> <ExternalLink className="w-2.5 h-2.5 shrink-0" />
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
            <div className="w-7 h-7 rounded-md bg-amber-600 flex items-center justify-center text-white text-xs shrink-0">
              <Zap className="w-3.5 h-3.5 fill-white" />
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2 rounded-tl-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> Predefined answer lookup...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
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
            placeholder={
              currentStep === 'ask_email'
                ? "Enter your email..."
                : currentStep === 'ask_mobile'
                ? "Enter your phone number..."
                : "Type your question..."
            }
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shadow transition-all disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Callback Request Modal */}
      {callbackOpen && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" /> Request Callback
              </span>
              <button onClick={() => setCallbackOpen(false)} className="text-slate-400 text-xs">✕</button>
            </div>

            {callbackDone ? (
              <div className="text-center py-3 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs font-bold text-white">Callback Scheduled!</div>
                <button
                  onClick={() => setCallbackOpen(false)}
                  className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  setCallbackDone(true);
                }}
                className="space-y-2 text-xs"
              >
                <div>
                  <label className="text-slate-400 block text-[10px] mb-0.5">Your Name</label>
                  <input
                    type="text"
                    required
                    value={cbName}
                    onChange={e => setCbName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px] mb-0.5">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={cbPhone}
                    onChange={e => setCbPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs mt-1"
                >
                  Confirm Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
