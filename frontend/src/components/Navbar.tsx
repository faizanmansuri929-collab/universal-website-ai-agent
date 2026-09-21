'use client';

import Link from 'next/link';
import { Bot, Sparkles, Globe, GraduationCap, ShoppingBag } from 'lucide-react';


export default function Navbar() {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">OmniAgent AI</span>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-600" /> Live Platform
              </span>
            </div>
            <p className="text-xs text-slate-500">Universal Website-to-AI Assistant</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/scraper"
            className="text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
            <span>Product Scraper</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-[10px] text-white font-extrabold uppercase">New</span>
          </Link>

          <Link
            href="/xyz-college"
            className="text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-3.5 py-1.5 rounded-xl border border-blue-200 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>XYZ College AI Portal</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </Link>

          <Link
            href="/"
            className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all"
          >
            <Globe className="w-4 h-4 text-blue-600" /> New Crawl
          </Link>
        </div>
      </div>
    </header>
  );
}

