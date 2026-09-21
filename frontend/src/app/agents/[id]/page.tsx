'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Agent, Page, api } from '@/lib/api';
import CrawlProgress from '@/components/CrawlProgress';
import ChatInterface from '@/components/ChatInterface';
import KnowledgeBase from '@/components/KnowledgeBase';
import AdmissionLeads from '@/components/AdmissionLeads';
import WidgetEmbedModal from '@/components/WidgetEmbedModal';
import { Globe, RefreshCw, Code, MessageSquare, Database, ArrowLeft, ExternalLink, Sparkles, Building2, Users, Flame } from 'lucide-react';

export default function AgentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'leads' | 'knowledge'>('chat');
  const [showWidgetModal, setShowWidgetModal] = useState(false);

  const fetchAgentData = async () => {
    try {
      const agentData = await api.getAgent(agentId);
      setAgent(agentData);

      const pageData = await api.getAgentPages(agentId);
      setPages(pageData);
    } catch (err) {
      console.error('Failed to fetch agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, [agentId]);

  useEffect(() => {
    if (!agent) return;

    if (agent.status === 'CRAWLING' || agent.status === 'QUEUED') {
      const interval = setInterval(() => {
        fetchAgentData();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [agent?.status]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-slate-400 text-sm">Loading Agent Dashboard...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-white">Agent Not Found</h2>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* Top Header Card with Sector Intelligence & Confidence Badge */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">{agent.name}</h1>
                
                {/* Sector Intelligence Badge */}
                <div
                  className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 text-purple-300"
                  title={agent.sector_reason || 'Automatically classified industry sector'}
                >
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sector: {sectorNameMap[agent.detected_sector] || agent.detected_sector}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-200">
                    {Math.round(agent.sector_confidence * 100)}% confidence
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-1.5">
                <a
                  href={agent.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <Globe className="w-3.5 h-3.5" /> {agent.website_url}
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>

                {agent.sector_reason && (
                  <span className="text-xs text-slate-400 truncate max-w-md hidden md:inline">
                    • {agent.sector_reason}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWidgetModal(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition-colors shadow-sm"
            >
              <Code className="w-4 h-4 text-purple-400" /> Embed Widget
            </button>
          </div>
        </div>

        {/* Crawl Progress Notification banner */}
        <CrawlProgress job={agent.active_job} agentStatus={agent.status} />
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'chat'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Admission Chat Sandbox
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'leads'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" /> Admission Leads & CRM
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
              NEW
            </span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'knowledge'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Database className="w-4 h-4" /> Knowledge Base & Inspector ({pages.length})
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          <ChatInterface
            agentId={agent.id}
            agentName={agent.name}
            welcomeMessage={agent.welcome_message}
            primaryColor={agent.primary_color}
            detectedSector={agent.detected_sector}
          />
        </div>
      )}

      {activeTab === 'leads' && (
        <AdmissionLeads agentId={agent.id} />
      )}

      {activeTab === 'knowledge' && (
        <KnowledgeBase
          agentId={agent.id}
          pages={pages}
          lastCrawledAt={agent.last_crawled_at}
          detectedSector={agent.detected_sector}
          onRefresh={fetchAgentData}
        />
      )}

      {/* Embed Modal */}
      {showWidgetModal && (
        <WidgetEmbedModal
          agent={agent}
          onClose={() => setShowWidgetModal(false)}
          onUpdate={fetchAgentData}
        />
      )}
    </div>
  );
}

