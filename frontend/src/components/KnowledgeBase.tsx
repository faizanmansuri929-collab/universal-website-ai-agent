'use client';

import { useState, useEffect } from 'react';
import { Page, PageDetail, Entity, api } from '@/lib/api';
import { RefreshCw, ExternalLink, FileText, CheckCircle2, Search, Eye, Layers, Sparkles, X, Tag } from 'lucide-react';

interface KnowledgeBaseProps {
  agentId: string;
  pages: Page[];
  lastCrawledAt?: string;
  detectedSector?: string;
  onRefresh: () => void;
}

export default function KnowledgeBase({
  agentId,
  pages,
  lastCrawledAt,
  detectedSector = 'general',
  onRefresh,
}: KnowledgeBaseProps) {
  const [subTab, setSubTab] = useState<'pages' | 'entities'>('pages');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [recrawling, setRecrawling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectPageId, setInspectPageId] = useState<string | null>(null);
  const [pageDetail, setPageDetail] = useState<PageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    api.getAgentEntities(agentId)
      .then(data => setEntities(data))
      .catch(err => console.error('Failed to load entities:', err));
  }, [agentId, pages]);

  const handleRecrawl = async () => {
    setRecrawling(true);
    try {
      await api.recrawlAgent(agentId);
      onRefresh();
    } catch (err) {
      console.error('Failed to trigger recrawl:', err);
    } finally {
      setRecrawling(false);
    }
  };

  const handleInspectPage = async (pageId: string) => {
    setInspectPageId(pageId);
    setLoadingDetail(true);
    try {
      const detail = await api.getPageDetail(agentId, pageId);
      setPageDetail(detail);
    } catch (err) {
      console.error('Failed to load page details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredPages = pages.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEntities = entities.filter(
    (e) =>
      e.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalChars = pages.reduce((acc, p) => acc + (p.char_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Controls & Manual Recrawl Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg">
        <div>
          <h3 className="font-semibold text-white text-base">Website Knowledge Base</h3>
          <p className="text-xs text-slate-400 mt-1">
            Last synced:{' '}
            <span className="text-slate-300 font-medium">
              {lastCrawledAt ? new Date(lastCrawledAt).toLocaleString() : 'Never'}
            </span>
          </p>
        </div>

        <button
          onClick={handleRecrawl}
          disabled={recrawling}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recrawling ? 'animate-spin' : ''}`} />
          {recrawling ? 'Re-Crawling...' : 'Re-Crawl / Update Website Data'}
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400">Total Indexed Pages</span>
          <div className="text-2xl font-bold text-white">{pages.length}</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400">Structured Entities</span>
          <div className="text-2xl font-bold text-purple-400">{entities.length}</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400">Knowledge Volume</span>
          <div className="text-2xl font-bold text-blue-400">
            {(totalChars / 1000).toFixed(1)}k chars
          </div>
        </div>
      </div>

      {/* Sub Tabs: Pages vs Entities */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('pages')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            subTab === 'pages'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Pages ({pages.length})
        </button>

        <button
          onClick={() => setSubTab('entities')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            subTab === 'entities'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5" /> Structured Entities ({entities.length})
        </button>
      </div>

      {/* Content Table */}
      {subTab === 'pages' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search indexed pages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-slate-400">
              Showing {filteredPages.length} of {pages.length} pages
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Page Title</th>
                  <th className="p-3.5">URL</th>
                  <th className="p-3.5 text-right">Content Size</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-medium text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate max-w-[240px]">{page.title || 'Untitled Page'}</span>
                    </td>
                    <td className="p-3.5">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-[11px] truncate max-w-[280px]"
                      >
                        {page.url} <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />
                      </a>
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-400">
                      {page.char_count.toLocaleString()} chars
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleInspectPage(page.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-[11px] flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3 h-3" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Structured Entities Tab */}
      {subTab === 'entities' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search entities (e.g. course name, doctor)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <span className="text-xs text-slate-400">
              Showing {filteredEntities.length} of {entities.length} entities
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Entity Name</th>
                  <th className="p-3.5">Entity Type</th>
                  <th className="p-3.5">Attributes</th>
                  <th className="p-3.5">Source URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEntities.map((ent) => (
                  <tr key={ent.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{ent.entity_name}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {ent.entity_type}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-300">
                      {JSON.stringify(ent.attributes)}
                    </td>
                    <td className="p-3.5">
                      <a
                        href={ent.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-[11px] truncate max-w-[200px]"
                      >
                        {ent.source_url} <ExternalLink className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOURCE INSPECTOR MODAL */}
      {inspectPageId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => {
                setInspectPageId(null);
                setPageDetail(null);
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4" /> Source Page Inspector
              </div>
              <h2 className="text-lg font-bold text-white mt-1 truncate max-w-xl">
                {pageDetail?.title || 'Loading Page Inspector...'}
              </h2>
              {pageDetail && (
                <p className="text-xs text-blue-400 font-mono mt-0.5">{pageDetail.url}</p>
              )}
            </div>

            {pageDetail && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block">Sector Classification:</span>
                    <span className="text-purple-300 font-mono font-bold uppercase">{detectedSector}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Content Size:</span>
                    <span className="text-blue-300 font-mono font-bold">{pageDetail.char_count} characters</span>
                  </div>
                </div>

                {pageDetail.entities.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-slate-300">Detected Structured Entities ({pageDetail.entities.length}):</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {pageDetail.entities.map(e => (
                        <span key={e.id} className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono">
                          {e.entity_name} ({e.entity_type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-300">Cleaned & Structured Page Text:</h4>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                    {pageDetail.content_text}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
