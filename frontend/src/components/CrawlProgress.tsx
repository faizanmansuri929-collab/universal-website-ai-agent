'use client';

import { CrawlJob } from '@/lib/api';
import { Loader2, CheckCircle2, AlertCircle, Globe, Hash, Layers } from 'lucide-react';

interface CrawlProgressProps {
  job?: CrawlJob;
  agentStatus: string;
}

export default function CrawlProgress({ job, agentStatus }: CrawlProgressProps) {
  if (!job) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-slate-400 text-sm">
        <span>No active crawl job found</span>
      </div>
    );
  }

  const isCrawling = agentStatus === 'CRAWLING' || job.status === 'CRAWLING' || job.status === 'QUEUED';
  const isCompleted = agentStatus === 'COMPLETED' || job.status === 'COMPLETED';
  const isFailed = agentStatus === 'FAILED' || job.status === 'FAILED';

  const percent = job.pages_discovered > 0
    ? Math.min(100, Math.round(((job.pages_processed + job.pages_skipped + job.pages_failed) / job.pages_discovered) * 100))
    : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isCrawling && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {isFailed && <AlertCircle className="w-5 h-5 text-red-400" />}
          <div>
            <h3 className="font-semibold text-slate-200 text-sm">
              {isCrawling ? 'Crawling Website & Indexing Knowledge Base...' : isCompleted ? 'Knowledge Base Ready' : 'Crawl Error'}
            </h3>
            {job.current_page_url && isCrawling && (
              <p className="text-xs text-slate-400 truncate max-w-md">
                Crawling: <span className="text-slate-300 font-mono">{job.current_page_url}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
            isCrawling ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            isCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {job.status}
          </span>
          {isCrawling && (
            <span className="font-mono text-xs text-blue-400 font-bold">{percent}%</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isCrawling && (
        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(5, percent)}%` }}
          ></div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" /> Discovered
          </div>
          <div className="text-lg font-bold text-slate-200 mt-1">{job.pages_discovered}</div>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" /> Indexed Pages
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-1">{job.pages_indexed}</div>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-400" /> Skipped / Unchanged
          </div>
          <div className="text-lg font-bold text-slate-300 mt-1">{job.pages_skipped}</div>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Failed
          </div>
          <div className="text-lg font-bold text-slate-300 mt-1">{job.pages_failed}</div>
        </div>
      </div>
    </div>
  );
}
