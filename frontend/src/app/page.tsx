'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Globe, ArrowRight, Layers, ShieldCheck, Zap, Bot, RefreshCw,
  FileText, GraduationCap, Award, CheckCircle2, Sparkles, Server,
  Database, Users, Clock, Flame, Building2, ShoppingBag
} from 'lucide-react';

import { api, Agent, HardcodedBot } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [botMode, setBotMode] = useState<'ai' | 'hardcoded'>('hardcoded');
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState<'entire_website' | 'subpath' | 'current_page'>('entire_website');
  const [sector, setSector] = useState<string>('college');
  const [ttlDays, setTtlDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Existing bots list
  const [aiAgents, setAiAgents] = useState<Agent[]>([]);
  const [hardcodedBots, setHardcodedBots] = useState<HardcodedBot[]>([]);

  useEffect(() => {
    // Load existing bots
    api.listHardcodedBots().then(setHardcodedBots).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      if (botMode === 'hardcoded') {
        const bot = await api.createHardcodedBot(url.trim(), undefined, sector, ttlDays);
        router.push(`/hardcoded/${bot.id}`);
      } else {
        const agent = await api.createAgent(url.trim(), scope);
        router.push(`/agents/${agent.id}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to initialize chatbot creation. Please check the URL.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-10">
      {/* Featured Spotlight: XYZ College AI Assistant */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-2xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur text-xs font-semibold flex items-center gap-1.5 text-blue-100">
              <Award className="w-3.5 h-3.5 text-amber-300" /> Featured College Intelligence
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-semibold">
              Live Crawled (21 Topics)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            XYZ Group of Colleges (XYZCE &amp; XYZIET)
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
            REAP Codes <strong>1023</strong> &amp; <strong>1050</strong>, NAAC A+, 12 B.Tech specializations, ₹82k core scholarship fees, and verified placements.
          </p>
        </div>

        <Link
          href="/xyz-college"
          className="z-10 px-5 py-3 bg-white hover:bg-blue-50 text-blue-900 font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all shrink-0"
        >
          <GraduationCap className="w-4 h-4 text-blue-700" />
          <span>Open XYZ College AI Portal</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* NEW: Product Scraper Feature Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-indigo-700/50">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs font-bold flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-indigo-300" /> New Module: Product Scraper
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-bold">
              Instamart &amp; E-Commerce
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">
            Scrape Product Listings into Structured Data &amp; Export
          </h3>
          <p className="text-xs text-indigo-100 max-w-xl">
            Extract product names, selling prices, MRP, discounts, pack sizes, images, and inventory status into a sortable table with 1-click CSV and Excel (.xlsx) export.
          </p>
        </div>

        <Link
          href="/scraper"
          className="px-5 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all shrink-0"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Open Product Scraper</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>


      {/* Hero Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-sm">
          <Zap className="w-3.5 h-3.5" /> Two High-Performance Chatbot Engines
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Turn Any Website Into An <br />
          <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-900 bg-clip-text text-transparent">
            AI or Predefined Chatbot
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Choose between our <strong>Zero-LLM Hardcoded Predefined Chatbot</strong> (instant speed, predictable FAQ answers, 7-day TTL caching) or our <strong>Live AI RAG Chatbot</strong> (dynamic semantic reasoning).
        </p>
      </div>

      {/* Main Creation Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* ENGINE MODE SELECTOR */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-900">
            Select Chatbot Engine Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hardcoded Option */}
            <button
              type="button"
              onClick={() => setBotMode('hardcoded')}
              className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                botMode === 'hardcoded'
                  ? 'border-blue-600 bg-blue-50/90 text-blue-950 ring-2 ring-blue-500/20 shadow-md'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-base flex items-center gap-2 text-blue-900">
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span>Hardcoded / Predefined Chatbot</span>
                  </div>
                  {botMode === 'hardcoded' && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  One-time OpenAI crawl → Predefined FAQ/Intent dataset saved in DB → <strong>0 LLM calls at runtime</strong>, conversational email &amp; phone lead capture, 7-day TTL.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center gap-2 text-[11px] font-semibold text-blue-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Fastest Response &bull; Zero Runtime Cost &bull; Lead Capture
              </div>
            </button>

            {/* AI RAG Option */}
            <button
              type="button"
              onClick={() => setBotMode('ai')}
              className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                botMode === 'ai'
                  ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 ring-2 ring-indigo-500/20 shadow-md'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-base flex items-center gap-2 text-indigo-900">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <span>AI / RAG Chatbot</span>
                  </div>
                  {botMode === 'ai' && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Vector index + semantic retrieval + live LLM reasoning for every message with real website citations and admissions scoring.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-indigo-200/60 flex items-center gap-2 text-[11px] font-semibold text-indigo-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Dynamic Reasoning &bull; Full Text Retrieval &bull; Student/Teacher Modes
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-slate-900">
                Website URL to Ingest
              </label>
              <button
                type="button"
                onClick={() => setUrl('https://www.xyzcollege.edu.in/')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Quick Fill: xyzcollege.edu.in
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="https://www.xyzcollege.edu.in/ or your-website.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base transition-all"
                required
              />
            </div>
          </div>

          {/* Hardcoded Specific Options */}
          {botMode === 'hardcoded' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Target Sector Template
                </label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="college">🎓 College / University / Education</option>
                  <option value="hospital">🏥 Hospital / Healthcare</option>
                  <option value="saas">💻 Software / SaaS</option>
                  <option value="manufacturing">🏭 Manufacturing / Industrial</option>
                  <option value="general">🏢 General Organization</option>
                </select>
                <p className="text-[11px] text-slate-500">Auto-detected if left as default or automatically refined during crawl.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Dataset Version TTL (Cache Duration)
                </label>
                <select
                  value={ttlDays}
                  onChange={(e) => setTtlDays(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={7}>7 Days (Default Standard)</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={90}>90 Days (Quarterly)</option>
                </select>
                <p className="text-[11px] text-slate-500">Flags bot as 'Update Required' upon expiration without auto-re-crawling.</p>
              </div>
            </div>
          ) : (
            /* AI RAG Specific Scope */
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-900">
                Crawl Scope
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setScope('entire_website')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    scope === 'entire_website'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    Entire Website
                    {scope === 'entire_website' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Crawl all discovered pages across domain.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('subpath')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    scope === 'subpath'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    Specific Path
                    {scope === 'subpath' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Only crawl pages under URL path.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('current_page')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    scope === 'current_page'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    Single Page
                    {scope === 'current_page' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Process only the exact URL entered.
                  </div>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 px-6 text-white font-bold text-base rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              botMode === 'hardcoded'
                ? 'bg-gradient-to-r from-blue-600 to-amber-600 hover:from-blue-700 hover:to-amber-700 shadow-blue-500/20'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/20'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                {botMode === 'hardcoded' ? 'Generating Predefined FAQ Dataset...' : 'Initializing Crawl Pipeline...'}
              </>
            ) : (
              <>
                {botMode === 'hardcoded' ? (
                  <>
                    <Zap className="w-5 h-5" /> Generate Hardcoded Predefined Chatbot <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <Bot className="w-5 h-5" /> Start Crawling &amp; Build AI RAG Chatbot <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </>
            )}
          </button>
        </form>
      </div>

      {/* RECENT HARDCODED BOTS DASHBOARD SECTION */}
      {hardcodedBots.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h3 className="font-bold text-slate-900 text-base">Your Hardcoded / Predefined Chatbots</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              {hardcodedBots.length} Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hardcodedBots.map((b) => (
              <Link
                key={b.id}
                href={`/hardcoded/${b.id}`}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all bg-slate-50/50 hover:bg-white flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                      {b.name}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      b.status === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status === 'UPDATE_REQUIRED'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800 animate-pulse'
                    }`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate font-mono mt-1">
                    {b.website_url}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-2">
                    <span>📚 <strong>{b.faqs_count}</strong> FAQs</span>
                    <span>&bull;</span>
                    <span>👥 <strong>{b.visitors_count}</strong> Leads</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Zap className="w-5 h-5 fill-amber-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Zero Runtime LLM Calls</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pre-generates deterministic FAQ/Intent answers once. Chat matches instantly from backend database with 0 per-query API costs.
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Grounded Sector Knowledge</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Strict website grounding. No invented fees, doctors, or deadlines. Unanswered queries route gracefully to Advisors or AI.
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Conversational Lead Capture</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Seamlessly captures visitor Email and Mobile number on first touch before proceeding to instant answers.
          </p>
        </div>
      </div>
    </div>
  );
}
