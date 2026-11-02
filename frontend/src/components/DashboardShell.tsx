'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot, Plus, Mic, Globe, GraduationCap, Users, ArrowLeft,
  Moon, Sun, Menu, X, Radio
} from 'lucide-react';
import { api } from '@/lib/api';

interface DashboardShellProps {
  children: React.ReactNode;
  activeNav?: 'home' | 'college-voice-search' | 'college-web-search' | 'xyz-college' | 'lead-engine' | 'test-voice';
}

export default function DashboardShell({ children, activeNav }: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  useEffect(() => {
    // Check real backend status
    api.checkHealth().then(res => {
      if (res && res.status === 'online') {
        setIsBackendConnected(true);
      }
    }).catch(() => {});

    try {
      const saved = localStorage.getItem('yui_theme') || localStorage.getItem('omniagent_theme');
      if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      } else {
        document.documentElement.classList.remove('dark');
        setIsDark(false);
      }
    } catch (e) {}

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('yui_theme', 'dark');
      localStorage.setItem('omniagent_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('yui_theme', 'light');
      localStorage.setItem('omniagent_theme', 'light');
    }
  };

  const currentTab = activeNav || (
    pathname === '/college-voice-search' ? 'college-voice-search' :
    pathname === '/college-web-search' ? 'college-web-search' :
    pathname === '/xyz-college' ? 'xyz-college' :
    pathname === '/lead-engine' ? 'lead-engine' :
    pathname === '/test-voice' ? 'test-voice' : 'home'
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)]">
      <div className="flex min-h-screen">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 app-sidebar sticky top-0 h-screen z-30">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="Yui AI"
                className="h-[30px] w-auto bg-white rounded-lg p-[3px] shrink-0 shadow-sm transition-transform group-hover:scale-105"
              />
              <div>
                <b className="font-['Poppins'] font-bold text-base text-white leading-tight block">Yui AI</b>
                <small className="text-[11px] text-[#9FA1CC] leading-none block font-normal">Console</small>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-3 space-y-1" aria-label="App pages">
            <Link
              href="/?app=1"
              className={`app-nav-link ${currentTab === 'home' ? 'active' : ''}`}
            >
              <Plus className="w-4 h-4" />
              <span>Create Assistant</span>
              <span className="ml-auto text-[9px] text-[#9FA1CC] font-medium">New crawl</span>
            </Link>

            <Link
              href="/college-voice-search"
              className={`app-nav-link ${currentTab === 'college-voice-search' ? 'active' : ''}`}
            >
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>Voice Assistant</span>
              <span className="badge badge-amber ml-auto">Beta</span>
            </Link>

            <Link
              href="/college-web-search"
              className={`app-nav-link ${currentTab === 'college-web-search' ? 'active' : ''}`}
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Live Web Search</span>
            </Link>

            <Link
              href="/lead-engine"
              className={`app-nav-link ${currentTab === 'lead-engine' ? 'active' : ''}`}
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Lead Engine</span>
              <span className="badge badge-teal ml-auto">New</span>
            </Link>

            <Link
              href="/test-voice"
              className={`app-nav-link ${currentTab === 'test-voice' ? 'active' : ''}`}
            >
              <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Test Voice</span>
              <span className="badge !bg-rose-500/20 !text-rose-200 !border-rose-400/30 ml-auto">Live</span>
            </Link>
          </nav>

          <div className="p-3 border-t border-white/10 space-y-2">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-[#9FA1CC]">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isBackendConnected ? 'Backend connected' : 'Demo mode — backend not connected'}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="app-nav-link w-full text-left"
              type="button"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Light mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-300" />
                  <span>Dark mode</span>
                </>
              )}
            </button>
            <Link href="/" className="app-nav-link">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to site</span>
            </Link>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile Header */}
          <header className="lg:hidden glass-nav sticky top-0 z-40 h-14 px-4 flex items-center justify-between gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl hover:bg-[var(--surface-3)]"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Yui AI"
                className="h-7 w-auto bg-white rounded-lg p-1 shrink-0 shadow-sm"
              />
              <div className="flex items-baseline gap-1.5">
                <span className="font-['Poppins'] font-bold text-sm">Yui AI</span>
                <span className="text-[10px] text-[var(--text-3)] font-medium">Console</span>
              </div>
            </Link>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-[var(--surface-3)]"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </header>

          <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-label="App navigation">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <aside className="absolute left-0 top-0 h-full w-72 app-sidebar p-4 space-y-1 drawer-panel overflow-y-auto z-10 shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="Yui AI"
                  className="h-8 w-auto bg-white rounded-lg p-1 shrink-0 shadow-sm"
                />
                <div>
                  <b className="font-['Poppins'] font-bold text-sm text-white leading-tight block">Yui AI</b>
                  <small className="text-[10px] text-[#9FA1CC] leading-none block font-normal">Console</small>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#C7C8E6] hover:text-white hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Link
              href="/?app=1"
              onClick={() => setMobileMenuOpen(false)}
              className={`app-nav-link ${currentTab === 'home' ? 'active' : ''}`}
            >
              <Plus className="w-4 h-4" />
              <span>Create Assistant</span>
            </Link>

            <Link
              href="/college-voice-search"
              onClick={() => setMobileMenuOpen(false)}
              className={`app-nav-link ${currentTab === 'college-voice-search' ? 'active' : ''}`}
            >
              <Mic className="w-4 h-4 text-teal-600" />
              <span>Voice Assistant</span>
              <span className="badge badge-amber ml-auto">Beta</span>
            </Link>

            <Link
              href="/college-web-search"
              onClick={() => setMobileMenuOpen(false)}
              className={`app-nav-link ${currentTab === 'college-web-search' ? 'active' : ''}`}
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>Live Web Search</span>
            </Link>

            <Link
              href="/lead-engine"
              onClick={() => setMobileMenuOpen(false)}
              className={`app-nav-link ${currentTab === 'lead-engine' ? 'active' : ''}`}
            >
              <Users className="w-4 h-4 text-teal-600" />
              <span>Lead Engine</span>
            </Link>

            <Link
              href="/test-voice"
              onClick={() => setMobileMenuOpen(false)}
              className={`app-nav-link ${currentTab === 'test-voice' ? 'active' : ''}`}
            >
              <Radio className="w-4 h-4 text-purple-600" />
              <span>Test Voice</span>
              <span className="badge !bg-purple-500/15 !text-purple-700 dark:!text-purple-300 !border-purple-500/30 ml-auto">Live</span>
            </Link>

            <div className="pt-3 mt-2 border-t bd space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] t3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span>{isBackendConnected ? 'Backend connected' : 'Demo mode — backend not connected'}</span>
              </div>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="app-nav-link"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to site</span>
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
