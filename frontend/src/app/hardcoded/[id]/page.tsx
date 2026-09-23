'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap, Bot, RefreshCw, MessageSquare, Database, Users, Code,
  ArrowLeft, ExternalLink, Sparkles, CheckCircle2, AlertTriangle,
  Flame, Clock, Search, Send, User, ChevronDown, ChevronUp,
  PhoneCall, Building2, HelpCircle, ArrowRight, ShieldCheck
} from 'lucide-react';
import { api, HardcodedBot, HardcodedFAQ, HardcodedVisitor, HardcodedChatResponse, Citation } from '@/lib/api';
import { MarkdownContent } from '@/components/MarkdownContent';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  cta?: { label: string; url: string };
  suggested_actions?: string[];
  fallback_triggered?: boolean;
  show_ask_ai?: boolean;
  show_request_callback?: boolean;
  timestamp: string;
}

export default function HardcodedBotDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.id as string;

  const [bot, setBot] = useState<HardcodedBot | null>(null);
  const [faqs, setFaqs] = useState<HardcodedFAQ[]>([]);
  const [visitors, setVisitors] = useState<HardcodedVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'sandbox' | 'faqs' | 'leads' | 'embed'>('sandbox');

  // FAQ Filter/Search state
  const [faqSearch, setFaqSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Chat Sandbox State
  const [sessionId, setSessionId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'ask_email' | 'ask_mobile' | 'active'>('ask_email');
  const [capturedVisitor, setCapturedVisitor] = useState<HardcodedVisitor | null>(null);

  // Callback modal
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);
  const [callbackSuccess, setCallbackSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchBotData = async () => {
    try {
      const botData = await api.getHardcodedBot(botId);
      setBot(botData);

      const faqsData = await api.getHardcodedBotFaqs(botId);
      setFaqs(faqsData);

      const visitorData = await api.getHardcodedBotVisitors(botId);
      setVisitors(visitorData);
    } catch (err) {
      console.error('Failed to fetch hardcoded bot:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBotData();
  }, [botId]);

  // Polling during generation
  useEffect(() => {
    if (!bot) return;
    if (bot.status === 'QUEUED' || bot.status === 'CRAWLING' || bot.status === 'GENERATING') {
      const interval = setInterval(() => {
        fetchBotData();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [bot?.status]);

  // Initialize Welcome Message in Sandbox
  useEffect(() => {
    if (bot && chatMessages.length === 0) {
      resetChatSandbox();
    }
  }, [bot?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const resetChatSandbox = () => {
    const newSessionId = 'sess_' + Date.now();
    setSessionId(newSessionId);
    setCurrentStep('ask_email');
    setCapturedVisitor(null);
    setChatMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `👋 Welcome to **${bot?.name || 'our Predefined Assistant'}**!\n\nBefore we get started, please enter your **email address**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMsg).trim();
    if (!text || chatLoading || !bot) return;

    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMsg('');
    setChatLoading(true);

    try {
      const res: HardcodedChatResponse = await api.chatWithHardcodedBot(
        bot.id,
        text,
        sessionId,
        capturedVisitor ? { email: capturedVisitor.email, mobile: capturedVisitor.mobile } : undefined
      );

      setSessionId(res.session_id);
      setCurrentStep(res.step);

      if (res.visitor) {
        setCapturedVisitor(res.visitor);
        // Refresh visitors list in background
        api.getHardcodedBotVisitors(bot.id).then(setVisitors).catch(console.error);
      }

      const botMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        cta: res.cta,
        suggested_actions: res.suggested_actions,
        fallback_triggered: res.fallback_triggered,
        show_ask_ai: res.show_ask_ai,
        show_request_callback: res.show_request_callback,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your query. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!bot) return;
    setRegenerating(true);
    try {
      await api.regenerateHardcodedBot(bot.id);
      await fetchBotData();
    } catch (err) {
      console.error('Failed to regenerate:', err);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading Predefined Chatbot Management...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-white">Predefined Chatbot Not Found</h2>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          Return Home
        </button>
      </div>
    );
  }

  const sectorNameMap: Record<string, string> = {
    college: 'College / University / Education',
    hospital: 'Hospital / Healthcare',
    saas: 'Software / SaaS',
    manufacturing: 'Manufacturing / Industrial',
    general: 'General Organization'
  };

  const categories = Array.from(new Set(faqs.map((f) => f.category || 'General')));

  const filteredFaqs = faqs.filter((f) => {
    const matchesCategory = selectedCategory === 'ALL' || f.category === selectedCategory;
    if (!faqSearch.trim()) return matchesCategory;
    const s = faqSearch.toLowerCase();
    const qMatch = f.questions.some((q) => q.toLowerCase().includes(s));
    const aMatch = f.answer.toLowerCase().includes(s);
    const iMatch = f.intent.toLowerCase().includes(s);
    return matchesCategory && (qMatch || aMatch || iMatch);
  });

  const isExpired = bot.is_expired || (bot.expires_at && new Date(bot.expires_at) < new Date());

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* HEADER CARD: BOT SPECIFICATIONS & TTL CONTROLS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 transition-colors shrink-0 mt-0.5"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-6 h-6 text-amber-400 fill-amber-400" />
                  <h1 className="text-2xl font-bold text-white tracking-tight">{bot.name}</h1>
                </div>

                {/* Status Badge */}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    bot.status === 'READY' && !isExpired
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : bot.status === 'UPDATE_REQUIRED' || isExpired
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-pulse'
                      : 'bg-blue-500/10 border border-blue-500/30 text-blue-300 animate-pulse'
                  }`}
                >
                  {isExpired ? 'UPDATE REQUIRED (EXPIRED)' : bot.status.replace('_', ' ')}
                </span>

                {/* Version Badge */}
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs">
                  v{bot.version}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <a
                  href={bot.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> {bot.website_url}
                </a>

                <span>&bull;</span>
                <span className="flex items-center gap-1 text-purple-300">
                  <Building2 className="w-3.5 h-3.5" /> Sector: {sectorNameMap[bot.sector] || bot.sector}
                </span>

                <span>&bull;</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Database className="w-3.5 h-3.5 text-blue-400" /> {faqs.length} Predefined FAQs
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActiveTab('sandbox')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'sandbox'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Preview Chatbot
            </button>

            <button
              onClick={() => setActiveTab('faqs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'faqs'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Database className="w-4 h-4" /> View FAQs ({faqs.length})
            </button>

            <button
              onClick={handleRegenerate}
              disabled={regenerating || bot.status === 'GENERATING' || bot.status === 'CRAWLING'}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating || bot.status === 'GENERATING' ? 'animate-spin' : ''}`} />
              <span>Regenerate Answers</span>
            </button>
          </div>
        </div>

        {/* METRICS & TTL STATUS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 block">Created Date</span>
            <span className="text-slate-200 font-semibold font-mono">
              {new Date(bot.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 block">Expiration (TTL {bot.ttl_days} Days)</span>
            <span className={`font-semibold font-mono ${isExpired ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
              {bot.expires_at ? new Date(bot.expires_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 block">Captured Leads</span>
            <span className="text-emerald-400 font-bold font-mono text-sm">
              {visitors.length} Visitors
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 block">Runtime Cost</span>
            <span className="text-amber-400 font-bold font-mono text-sm">
              $0.00 / Query (Zero LLM)
            </span>
          </div>
        </div>

        {/* Generation / Expiration Warning Banner */}
        {bot.status === 'GENERATING' || bot.status === 'CRAWLING' ? (
          <div className="p-3.5 bg-blue-950/50 border border-blue-500/30 rounded-xl flex items-center gap-3 text-xs text-blue-200">
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
            <div>
              <strong>Crawling &amp; OpenAI Predefined Extraction Active:</strong> Discovering pages, detecting sector templates, and generating deterministic FAQ dataset in backend database.
            </div>
          </div>
        ) : isExpired ? (
          <div className="p-3.5 bg-amber-950/50 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                <strong>Dataset Expired ({bot.ttl_days}-day TTL reached):</strong> The predefined answers need review or refresh. Click [Regenerate Answers] to re-sync with the live website.
              </span>
            </div>
            <button
              onClick={handleRegenerate}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shrink-0"
            >
              Regenerate Now
            </button>
          </div>
        ) : null}
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'sandbox'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Live Chat Preview Sandbox
          </button>

          <button
            onClick={() => setActiveTab('faqs')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'faqs'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900'
            }`}
          >
            <Database className="w-4 h-4" /> Predefined FAQ Inspector ({faqs.length})
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'leads'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" /> Captured Leads ({visitors.length})
          </button>

          <button
            onClick={() => setActiveTab('embed')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'embed'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900'
            }`}
          >
            <Code className="w-4 h-4 text-purple-400" /> Embed Widget
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE CHAT PREVIEW SANDBOX */}
      {activeTab === 'sandbox' && (
        <div className="flex flex-col h-[700px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
          {/* Sandbox Top Bar */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                <Zap className="w-4 h-4 fill-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 text-xs sm:text-sm">{bot.name} (Deterministic Runtime)</h3>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Step: <strong className="text-blue-400 uppercase font-mono">{currentStep.replace('_', ' ')}</strong></span>
                  {capturedVisitor && (
                    <span className="text-emerald-300 font-mono">&bull; Visitor: {capturedVisitor.email}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={resetChatSandbox}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              Reset Session
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-2 ${
                  msg.role === 'user' ? 'ml-auto items-end max-w-[85%]' : 'mr-auto items-start max-w-[90%]'
                }`}
              >
                <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                      msg.role === 'user' ? 'bg-indigo-600' : 'bg-amber-600'
                    }`}
                  >
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-white" />}
                  </div>

                  <div className="space-y-2">
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                      }`}
                    >
                      <MarkdownContent
                        content={msg.content}
                        isUser={msg.role === 'user'}
                        className={msg.role === 'user' ? 'text-white' : 'text-slate-200'}
                      />

                      {/* CALL TO ACTION BUTTON */}
                      {msg.cta && msg.cta.url && (
                        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center">
                          <a
                            href={msg.cta.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 transition-all"
                          >
                            <span>{msg.cta.label || 'Take Action'}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}

                      {/* FALLBACK ACTIONS (Ask AI Assistant / Request Callback) */}
                      {msg.fallback_triggered && (
                        <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                          {msg.show_request_callback && (
                            <button
                              onClick={() => {
                                setCallbackSuccess(false);
                                setCallbackModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Request Callback</span>
                            </button>
                          )}

                          {msg.show_ask_ai && (
                            <Link
                              href={`/agents/${bot.agent_id || bot.id}`}
                              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all"
                            >
                              <Bot className="w-3.5 h-3.5" />
                              <span>Ask AI Assistant (Live RAG)</span>
                            </Link>
                          )}
                        </div>
                      )}

                      {/* SUGGESTED ACTIONS PILLS */}
                      {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold block">Predefined Topics:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggested_actions.map((act, i) => (
                              <button
                                key={i}
                                onClick={() => handleSendMessage(act)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-amber-300 hover:text-amber-200 transition-all text-left"
                              >
                                {act}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* GROUNDED CITATIONS */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" /> Source Citations:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.citations.map((c, i) => (
                              <a
                                key={i}
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-mono hover:underline truncate max-w-[240px]"
                              >
                                <span>{c.url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`text-[10px] text-slate-500 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3 mr-auto max-w-[80%]">
                <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-sm flex items-center gap-2 rounded-tl-none">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> Matching query against predefined database...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder={
                  currentStep === 'ask_email'
                    ? "Enter your email (e.g., student@example.com)..."
                    : currentStep === 'ask_mobile'
                    ? "Enter your mobile number (e.g., +91 98765 43210)..."
                    : "Ask any question from the predefined FAQ dataset..."
                }
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                disabled={chatLoading}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !inputMsg.trim()}
                className="w-11 h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shadow-lg transition-all disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: PREDEFINED FAQ INSPECTOR */}
      {activeTab === 'faqs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" /> Predefined Knowledge Dataset ({faqs.length} FAQs)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Grounded questions, answers, and source citations generated strictly from the crawled website.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search FAQs or intents..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Categories ({faqs.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat} ({faqs.filter((f) => f.category === cat).length})
              </button>
            ))}
          </div>

          {/* FAQs List Grid */}
          <div className="space-y-4">
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No predefined FAQs found matching your filter.
              </div>
            ) : (
              filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className="p-5 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl space-y-3 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-xs font-bold">
                        Intent: {faq.intent}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-xs font-medium">
                        {faq.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Priority: {faq.priority}/10
                    </span>
                  </div>

                  {/* Question Variations */}
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400">Trigger Question Variations:</span>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-200 font-medium pl-1">
                      {faq.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Grounded Answer */}
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    <span className="text-[11px] font-bold text-amber-400 block mb-1">Predefined Grounded Answer:</span>
                    <p className="whitespace-pre-wrap">{faq.answer}</p>
                  </div>

                  {/* Sources & CTA Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-500">Source:</span>
                      {faq.source_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          {url} <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>

                    {faq.cta_label && faq.cta_url && (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span>CTA:</span>
                        <a
                          href={faq.cta_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded text-emerald-300 hover:underline"
                        >
                          {faq.cta_label}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CAPTURED LEADS & CRM */}
      {activeTab === 'leads' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Captured Visitor Leads ({visitors.length})
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Leads automatically collected during conversational chatbot onboarding.
              </p>
            </div>
          </div>

          {visitors.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              No leads captured yet. Test the chatbot sandbox to register a visitor!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Course Interest</th>
                    <th className="p-3">12th Marks</th>
                    <th className="p-3">Date Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visitors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/40 transition-colors font-mono">
                      <td className="p-3 text-blue-400 font-bold">{v.email}</td>
                      <td className="p-3 text-emerald-400">{v.mobile || 'Pending'}</td>
                      <td className="p-3 text-slate-200">{v.student_name || 'Prospect'}</td>
                      <td className="p-3 text-purple-300">{v.course || 'General'}</td>
                      <td className="p-3">{v.percentage ? `${v.percentage}%` : '-'}</td>
                      <td className="p-3 text-slate-500">{new Date(v.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EMBED WIDGET */}
      {activeTab === 'embed' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-400" /> Embed Predefined Chatbot on Your Website
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Add this lightweight script to your HTML before the closing <code>&lt;/body&gt;</code> tag.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Option 1: Direct Embed Script</label>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto select-all">
                {`<script src="http://localhost:8000/widget.js" data-agent-id="${bot.id}" async></script>`}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Option 2: Standalone Widget URL</label>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-blue-400 overflow-x-auto flex items-center justify-between">
                <span>http://localhost:3000/hardcoded-widget/{bot.id}</span>
                <Link
                  href={`/hardcoded-widget/${bot.id}`}
                  target="_blank"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-sans font-semibold flex items-center gap-1 shrink-0"
                >
                  Open Widget <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALLBACK REQUEST MODAL */}
      {callbackModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span>Request Advisor Callback</span>
              </div>
              <button
                onClick={() => setCallbackModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            {callbackSuccess ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">Callback Request Confirmed!</h4>
                <p className="text-xs text-slate-300">
                  Our advisor has received your request and will contact you shortly.
                </p>
                <button
                  onClick={() => setCallbackModalOpen(false)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCallbackSuccess(true);
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    defaultValue={capturedVisitor?.student_name || 'Website Visitor'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    defaultValue={capturedVisitor?.mobile || '+91 98765 43210'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl mt-2"
                >
                  Submit Callback Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
