'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, ArrowRight, Layers, ShieldCheck, Zap, Bot, RefreshCw, FileText } from 'lucide-react';
import { api } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState<'entire_website' | 'subpath' | 'current_page'>('entire_website');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const agent = await api.createAgent(url.trim(), scope);
      router.push(`/agents/${agent.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to initialize website crawl. Please check the URL.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
          <Zap className="w-4 h-4" /> Instant Website-to-AI Chatbot Generation
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Turn Any Website Into An <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI Assistant with Citations
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Enter a public website URL. Our engine discovers pages, cleans content, builds a tenant-isolated knowledge base, and serves an grounded AI agent in seconds.
        </p>
      </div>

      {/* Main Creation Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-200">
              Website URL
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="https://example.com or company.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all"
                required
              />
            </div>
          </div>

          {/* Crawl Scope Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-200">
              Crawl Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setScope('entire_website')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  scope === 'entire_website'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-sm flex items-center justify-between">
                  Entire Website
                  {scope === 'entire_website' && <span className="w-2 h-2 rounded-full bg-blue-400"></span>}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Crawl all discovered pages across the domain.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('subpath')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  scope === 'subpath'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-sm flex items-center justify-between">
                  Specific Path
                  {scope === 'subpath' && <span className="w-2 h-2 rounded-full bg-blue-400"></span>}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Only crawl pages under the specified URL path.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('current_page')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  scope === 'current_page'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-sm flex items-center justify-between">
                  Current Page Only
                  {scope === 'current_page' && <span className="w-2 h-2 rounded-full bg-blue-400"></span>}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Process only the exact URL entered.
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-base rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Initializing Crawl Queue...
              </>
            ) : (
              <>
                Create AI Chatbot <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-xl space-y-2">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-200">Smart Async Crawler</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Extracts main text content while automatically stripping navigation headers, footers, scripts, ads, and cookie popups.
          </p>
        </div>

        <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-xl space-y-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-200">Strictly Grounded RAG</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Zero hallucination guarantee. Answers are generated exclusively from crawled website knowledge with direct URL source citations.
          </p>
        </div>

        <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-xl space-y-2">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-200">Manual Re-Crawl Sync</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Content MD5 hashing tracks website changes. Trigger manual sync anytime to refresh knowledge without duplicate processing.
          </p>
        </div>
      </div>
    </div>
  );
}
