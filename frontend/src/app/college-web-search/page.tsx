'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Globe, Bot, Send, Sparkles, ExternalLink, ShieldCheck, CheckCircle2,
  RefreshCw, Search, Layers, Sliders, ChevronDown, ChevronUp, AlertCircle,
  Clock, Database, ArrowRight, Zap, Info, Plus, Trash2, Check, X, BookOpen,
  GraduationCap, Building2, Briefcase, Home as HomeIcon, FileText
} from 'lucide-react';
import {
  api, WebSearchChatResponse, WebSearchSource,
  WebSearchConfig, WebSearchDebugTrace, Citation
} from '@/lib/api';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Citation[];
  sources_count?: number;
  is_live_searched?: boolean;
  debug_trace?: WebSearchDebugTrace;
  timestamp: string;
}

const SUGGESTED_PROMPTS = [
  "What B.Tech courses does Poornima offer?",
  "Tell me about campus placements & top recruiters.",
  "What hostel facilities and dining are available?",
  "What is the B.Tech admission process & eligibility?",
  "What are the annual placement statistics and packages?",
  "Tell me about the IBM collaboration and certifications."
];

export default function CollegeWebSearchPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'admin' | 'test'>('chat');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "👋 **Welcome to Poornima Live Web Assistant!**\n\nI am dynamically connected to the official **poornima.org** website with live URL search. You can ask me anything about B.Tech branches, admissions, eligibility, fee structure, hostels, or campus placements.",
      sources: [
        {
          url: "https://www.poornima.org/",
          title: "Poornima Group of Colleges & University - Official Home",
          snippet: "Official portal for Poornima University & Engineering Colleges in Jaipur.",
          source_type: "REAL_WEBSITE"
        },
        {
          url: "https://www.poornima.org/admission/btech-at-poornima-group-of-colleges",
          title: "B.Tech Admission Procedure & Eligibility",
          snippet: "B.Tech admission guidelines, specializations, and eligibility criteria.",
          source_type: "REAL_WEBSITE"
        }
      ],
      sources_count: 2,
      is_live_searched: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchStep, setSearchStep] = useState<string>('');
  const [expandedDebugId, setExpandedDebugId] = useState<string | null>(null);

  // Admin Allowlist state
  const [config, setConfig] = useState<WebSearchConfig | null>(null);
  const [sources, setSources] = useState<WebSearchSource[]>([]);
  const [sourceCategory, setSourceCategory] = useState<string>('All');
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Courses');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');

  // Test Tool state
  const [testQuery, setTestQuery] = useState('');
  const [testMaxSources, setTestMaxSources] = useState(3);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, searchStep]);

  useEffect(() => {
    loadConfigAndSources();
  }, []);

  const loadConfigAndSources = async () => {
    try {
      const [cfg, srcList] = await Promise.all([
        api.getWebSearchConfig(),
        api.getWebSearchSources()
      ]);
      setConfig(cfg);
      setSources(srcList);
    } catch (err) {
      console.error("Failed to load web search config/sources:", err);
    }
  };

  const handleSendMessage = async (msgToSend?: string) => {
    const text = (msgToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: ChatMessageItem = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    // Search Step Visual Progression
    setSearchStep('🔍 OpenAI analyzing query & selecting approved Poornima links...');

    const timer1 = setTimeout(() => {
      setSearchStep('📄 Live fetching verified content from poornima.org...');
    }, 900);

    const timer2 = setTimeout(() => {
      setSearchStep('✨ Synthesizing grounded answer with official citations...');
    }, 1800);

    try {
      const historyPayload = messages.slice(-4).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.chatWebSearch(text, historyPayload, true);

      clearTimeout(timer1);
      clearTimeout(timer2);
      setSearchStep('');

      const botMsg: ChatMessageItem = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        sources_count: res.sources_used_count,
        is_live_searched: res.is_live_searched,
        debug_trace: res.debug_trace,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setSearchStep('');
      console.error(err);
      
      const errorMsg: ChatMessageItem = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "⚠️ I encountered an issue retrieving live data from the Poornima website. Please try again or ask another question about courses and admissions.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setAdminLoading(true);
    setAdminMsg('');
    try {
      await api.addWebSearchSource({
        url: newUrl.trim(),
        title: newTitle.trim() || undefined,
        category: newCategory
      });
      setNewUrl('');
      setNewTitle('');
      setAdminMsg('✅ Source successfully added to allowlist!');
      loadConfigAndSources();
    } catch (err: any) {
      setAdminMsg(`❌ Error: ${err.response?.data?.detail || 'Failed to add URL. Must belong to poornima.org'}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleToggleSource = async (src: WebSearchSource) => {
    try {
      await api.updateWebSearchSource(src.id, { is_enabled: !src.is_enabled });
      setSources(prev => prev.map(s => s.id === src.id ? { ...s, is_enabled: !s.is_enabled } : s));
    } catch (err) {
      console.error("Failed to toggle source:", err);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Are you sure you want to remove this URL from the approved allowlist?")) return;
    try {
      await api.deleteWebSearchSource(id);
      setSources(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error("Failed to delete source:", err);
    }
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setTestLoading(true);
    try {
      const res = await api.testWebSearch(testQuery.trim(), testMaxSources);
      setTestResult(res);
    } catch (err) {
      console.error("Test search failed:", err);
    } finally {
      setTestLoading(false);
    }
  };

  const filteredSources = sources.filter(s => {
    const matchesCat = sourceCategory === 'All' || s.category.toLowerCase() === sourceCategory.toLowerCase();
    const matchesSearch = !sourceSearch || 
      s.title.toLowerCase().includes(sourceSearch.toLowerCase()) || 
      s.url.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(sourceSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const categories = ['All', 'Courses', 'Admissions', 'Placements', 'Hostels', 'About', 'Faculty', 'Infrastructure', 'Students', 'Events', 'Policies'];

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      {/* Top Banner & Mode Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-emerald-600/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                <Globe className="w-3.5 h-3.5 text-emerald-300" /> Poornima Live Web Assistant
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Web Search Active
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 text-xs font-mono">
                Domain: poornima.org ({sources.length} URLs)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Dynamic Poornima Website Search Chatbot
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
              OpenAI decides top 1–3 official Poornima URLs, fetches live web data on demand, and returns concise answers with verified source links.
            </p>
          </div>

          {/* Tab Controls */}
          <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-emerald-500/30 backdrop-blur-md self-start md:self-auto shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-emerald-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bot className="w-4 h-4" /> Live Chat
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-emerald-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-4 h-4" /> Allowlist ({sources.length})
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'test'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-emerald-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className="w-4 h-4" /> Search Debug
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: LIVE SEARCH CHAT */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Interface (3 cols) */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col h-[700px] overflow-hidden">
            {/* Chat Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/40">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {m.role === 'user' ? 'You' : 'Poornima Live AI'}
                    </span>
                    <span className="text-[10px] text-slate-400">{m.timestamp}</span>
                  </div>

                  <div
                    className={`p-4 sm:p-5 rounded-2xl max-w-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-gradient-to-tr from-emerald-700 to-teal-700 text-white rounded-br-sm shadow-md'
                        : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-line text-slate-800 leading-relaxed font-sans">
                      {m.content}
                    </div>

                    {/* SOURCE TRANSPARENCY SECTION */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-emerald-600" />
                              Sources used: <span className="text-emerald-700 font-extrabold">{m.sources.length} pages</span>
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                            Web searched just now
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {m.sources.map((src, sIdx) => (
                            <a
                              key={sIdx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 transition-all flex items-start justify-between gap-2 group text-left"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-800 group-hover:text-emerald-800 truncate">
                                  {src.title}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                                  {src.url.replace('https://www.poornima.org', 'poornima.org')}
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0 mt-0.5 transition-colors" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Collapsible Debug Trace Accordion */}
                    {m.debug_trace && (
                      <div className="mt-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setExpandedDebugId(expandedDebugId === m.id ? null : m.id)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                        >
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span>{expandedDebugId === m.id ? 'Hide Search Trace' : 'Show AI Search Decision & Trace'}</span>
                          {expandedDebugId === m.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {expandedDebugId === m.id && (
                          <div className="mt-2.5 p-3 bg-slate-900 text-emerald-300 rounded-xl text-xs font-mono space-y-2 border border-slate-700">
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                              <span className="text-slate-400">Detected Intent:</span>
                              <span className="text-white font-bold">{m.debug_trace.detected_intent}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                              <span className="text-slate-400">Optimized Query:</span>
                              <span className="text-emerald-400 truncate max-w-xs">{m.debug_trace.optimized_search_query}</span>
                            </div>
                            <div className="border-b border-slate-800 pb-1.5 space-y-1">
                              <span className="text-slate-400">AI Selection Reason:</span>
                              <p className="text-slate-300 font-sans text-[11px] leading-tight">
                                {m.debug_trace.ai_link_selection_reason || 'Relevance-ranked selection'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-400">Selected URLs ({m.debug_trace.selected_sources.length}):</span>
                              <ul className="list-disc pl-4 space-y-0.5 mt-1 text-slate-300 text-[11px]">
                                {m.debug_trace.selected_sources.map((s, idx) => (
                                  <li key={idx} className="truncate">
                                    {s.title} ({s.url})
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800">
                              <span>Latency: {m.debug_trace.processing_time_ms} ms</span>
                              <span>Cache: {m.debug_trace.cache_hit ? 'HIT' : 'MISS'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* SEARCH PROGRESS STEP INDICATOR */}
              {loading && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs font-semibold animate-pulse shadow-sm">
                  <RefreshCw className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
                  <span>{searchStep || 'Searching Poornima official website...'}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Prompts Pills */}
            <div className="px-4 py-2.5 bg-white border-t border-slate-100 overflow-x-auto flex items-center gap-2 shrink-0 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Prompts:
              </span>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={loading}
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-xs whitespace-nowrap transition-all font-medium disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask anything about Poornima B.Tech courses, fees, hostels, or placements..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Search &amp; Ask</span>
              </button>
            </form>
          </div>

          {/* Right Sidebar: Quick Details & Stats (1 col) */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Search Policy &amp; Security</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Queries are strictly restricted to <strong>poornima.org</strong>. Off-topic queries or third-party college inquiries are politely filtered out.
              </p>
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Approved Sources:</span>
                  <strong className="text-slate-900">{sources.length} URLs</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Max Sources / Query:</span>
                  <strong className="text-slate-900">{config?.max_sources_per_query || 3} pages</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cache Window:</span>
                  <strong className="text-slate-900">{((config?.cache_ttl_seconds || 600) / 60)} mins</strong>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-tr from-slate-900 to-emerald-950 text-white rounded-2xl p-5 shadow-sm space-y-3 border border-emerald-800/40">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>How This Engine Works</span>
              </div>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal pl-4">
                <li><strong>Intent Routing:</strong> Classifies user question into admissions, B.Tech, fees, placements, or hostels.</li>
                <li><strong>OpenAI Link Decision:</strong> Selects the 1–3 most accurate Poornima URLs from allowlist.</li>
                <li><strong>Live Fetching:</strong> Pulls real page text on the fly.</li>
                <li><strong>Grounded Answer:</strong> Synthesizes verified answer with clickable sources.</li>
              </ol>
            </div>

            <button
              onClick={() => setActiveTab('admin')}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Sliders className="w-4 h-4 text-slate-600" />
              <span>Manage 73 Allowlist URLs</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ALLOWLIST ADMIN */}
      {activeTab === 'admin' && (
        <div className="space-y-6">
          {/* Add New Source Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" /> Add New Official Poornima URL
                </h3>
                <p className="text-xs text-slate-500">Must strictly belong to the <code>poornima.org</code> domain.</p>
              </div>
            </div>

            {adminMsg && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
                {adminMsg}
              </div>
            )}

            <form onSubmit={handleAddSource} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-bold text-slate-700">Official URL</label>
                <input
                  type="url"
                  placeholder="https://www.poornima.org/admission/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-slate-700">Page Title / Label</label>
                <input
                  type="text"
                  placeholder="e.g. B.Tech Cyber Security"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="w-full p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </form>
          </div>

          {/* Sources Allowlist Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  Approved Sources Allowlist ({filteredSources.length} / {sources.length})
                </h3>
                <p className="text-xs text-slate-500">The AI assistant is strictly restricted to searching these URLs.</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search URLs or titles..."
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
                  />
                </div>

                <select
                  value={sourceCategory}
                  onChange={(e) => setSourceCategory(e.target.value)}
                  className="p-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-900 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-4">Page Title &amp; Category</th>
                    <th className="py-3 px-4">Official Poornima URL</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSources.map((src, idx) => (
                    <tr key={src.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{src.title}</div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {src.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-emerald-800">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1 group"
                        >
                          <span className="truncate max-w-sm">{src.url}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSource(src)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                            src.is_enabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {src.is_enabled ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove from allowlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEVELOPER SEARCH DEBUG & TEST TOOL */}
      {activeTab === 'test' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              Live Search Intent &amp; Link Selection Inspector
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Test how OpenAI classifies query intent, executes relevance ranking, and picks the top 1–3 Poornima URLs without invoking full answer generation.
            </p>
          </div>

          <form onSubmit={handleRunTest} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-9 space-y-1">
                <label className="text-xs font-bold text-slate-700">Test Query</label>
                <input
                  type="text"
                  placeholder="e.g. What is Poornima's CSE placement and average package?"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-slate-700">Max Sources</label>
                <select
                  value={testMaxSources}
                  onChange={(e) => setTestMaxSources(Number(e.target.value))}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={1}>1 Source</option>
                  <option value={2}>2 Sources</option>
                  <option value={3}>3 Sources (Default)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={testLoading || !testQuery.trim()}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {testLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Evaluating Query...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Run Search Test
                </>
              )}
            </button>
          </form>

          {/* Test Results Display */}
          {testResult && (
            <div className="p-5 rounded-2xl bg-slate-900 text-white font-mono text-xs space-y-4 border border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Detected Intent:</span>
                  <span className="text-emerald-400 font-bold text-sm">{testResult.detected_intent}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Optimized Search Query:</span>
                  <span className="text-white text-xs">{testResult.optimized_search_query}</span>
                </div>
              </div>

              <div>
                <span className="text-amber-400 font-bold block mb-2">
                  🏆 Top Selected Sources ({testResult.selected_sources.length}):
                </span>
                <div className="space-y-2">
                  {testResult.selected_sources.map((s: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-800/80 rounded-xl border border-emerald-500/30">
                      <div className="flex items-center justify-between">
                        <strong className="text-white text-xs">{s.title}</strong>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          Score: {s.score}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-300 truncate mt-0.5">{s.url}</div>
                      <div className="text-[10px] text-slate-400 mt-1">Status: {s.fetch_status || 'OK'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-2">
                  All Evaluated Candidates ({testResult.candidate_sources.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {testResult.candidate_sources.map((c: any, idx: number) => (
                    <div key={idx} className="p-2 bg-slate-800/40 rounded-lg text-[11px] border border-slate-700 truncate">
                      <span className="text-slate-400">#{idx+1} [{c.category}]</span> <span className="text-slate-200 font-semibold">{c.title}</span> (Score: {c.score})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
