'use client';

import Link from 'next/link';
import { Bot, Sparkles, Globe } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">OmniAgent AI</span>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> MVP Demo
              </span>
            </div>
            <p className="text-xs text-slate-400">Universal Website-to-AI Platform</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 rounded-lg border border-slate-700"
          >
            <Globe className="w-4 h-4 text-blue-400" /> New Chatbot
          </Link>
        </div>
      </div>
    </header>
  );
}
