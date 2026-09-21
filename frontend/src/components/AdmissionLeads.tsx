'use client';

import { useState, useEffect } from 'react';
import { AdmissionLead, LeadsSummaryResponse, api } from '@/lib/api';
import { 
  Users, Flame, TrendingUp, Sparkles, Search, Filter, Eye, X, 
  Phone, Mail, Calendar, Home, DollarSign, Award, CheckCircle2, AlertCircle, Clock
} from 'lucide-react';

interface AdmissionLeadsProps {
  agentId: string;
}

export default function AdmissionLeads({ agentId }: AdmissionLeadsProps) {
  const [summary, setSummary] = useState<LeadsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'REAL_CHAT' | 'DEMO_DATA'>('ALL');
  const [tempFilter, setTempFilter] = useState<'ALL' | 'HOT' | 'WARM' | 'COLD'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<AdmissionLead | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await api.getAgentLeads(agentId, sourceFilter, tempFilter, searchTerm);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load admission leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [agentId, sourceFilter, tempFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  const getTemperatureBadge = (temp: string) => {
    if (temp === 'HOT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" /> HOT
        </span>
      );
    }
    if (temp === 'WARM') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> WARM
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase bg-slate-500/10 text-slate-400 border border-slate-500/30">
        COLD
      </span>
    );
  };

  const getQualificationBadge = (status: string) => {
    if (status === 'ELIGIBLE') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Eligible
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
        <AlertCircle className="w-3 h-3 text-amber-400" /> Needs Review
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    if (source === 'REAL_CHAT') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          REAL CHAT
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
        DEMO DATA
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" /> Total Admission Leads
          </span>
          <div className="text-2xl font-bold text-white">
            {summary?.total_leads || 0}
          </div>
          <span className="text-[11px] text-slate-500">
            {summary?.real_leads_count || 0} Real / {summary?.demo_leads_count || 0} Demo
          </span>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-red-400" /> Hot Leads (High Priority)
          </span>
          <div className="text-2xl font-bold text-red-400">
            {summary?.hot_leads || 0}
          </div>
          <span className="text-[11px] text-red-400/80">Immediate Follow-up</span>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> High Income Tier
          </span>
          <div className="text-2xl font-bold text-emerald-400">
            {summary?.high_income_leads || 0}
          </div>
          <span className="text-[11px] text-emerald-400/80">₹10+ LPA Family Income</span>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Warm / Engaged Leads
          </span>
          <div className="text-2xl font-bold text-purple-400">
            {summary?.warm_leads || 0}
          </div>
          <span className="text-[11px] text-slate-400">Active Inquiry Pool</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-lg">
        {/* Source Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSourceFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sourceFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-950'
            }`}
          >
            All Leads ({summary?.total_leads || 0})
          </button>
          <button
            onClick={() => setSourceFilter('REAL_CHAT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              sourceFilter === 'REAL_CHAT'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-950'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Real Chat Captures ({summary?.real_leads_count || 0})
          </button>
          <button
            onClick={() => setSourceFilter('DEMO_DATA')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              sourceFilter === 'DEMO_DATA'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-950'
            }`}
          >
            <Sparkles className="w-3 h-3 text-purple-300" /> Demo Records ({summary?.demo_leads_count || 0})
          </button>
        </div>

        {/* Temperature Filter & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tempFilter}
            onChange={(e) => setTempFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Temperatures</option>
            <option value="HOT">🔥 HOT Priority</option>
            <option value="WARM">⚡ WARM</option>
            <option value="COLD">❄️ COLD</option>
          </select>

          <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search student or course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </form>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Mobile</th>
                <th className="p-3.5">Target Course</th>
                <th className="p-3.5">Academic Score</th>
                <th className="p-3.5">Family Income</th>
                <th className="p-3.5">Lead Priority</th>
                <th className="p-3.5">Qualification</th>
                <th className="p-3.5">Source</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary?.leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No admission leads found matching the selected filters.
                  </td>
                </tr>
              ) : (
                summary?.leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{lead.student_name}</span>
                        {lead.source === 'REAL_CHAT' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Captured in Real Live Chat"></span>
                        )}
                      </div>
                      {lead.father_name && (
                        <span className="text-[10px] text-slate-400 block font-normal">
                          S/D/O {lead.father_name}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono text-slate-300">
                      {lead.mobile_number}
                    </td>

                    <td className="p-3.5 font-medium text-blue-300 max-w-[200px] truncate">
                      {lead.course_name || 'General Inquiry'}
                    </td>

                    <td className="p-3.5 font-mono text-slate-200">
                      {lead.percentage !== undefined && lead.percentage !== null ? `${lead.percentage}%` : 'Pending'}
                      {lead.entrance_exam && (
                        <span className="text-[10px] text-purple-400 block font-sans">
                          {lead.entrance_exam} {lead.entrance_score}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-semibold text-emerald-400">
                      {lead.annual_income || 'Not Disclosed'}
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        {getTemperatureBadge(lead.lead_temperature)}
                        <span className="font-mono font-bold text-white text-xs">
                          {lead.lead_score}
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      {getQualificationBadge(lead.academic_qualification)}
                    </td>

                    <td className="p-3.5">
                      {getSourceBadge(lead.source)}
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedLead(lead)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-[11px] flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3 h-3" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAD INSPECTION MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedLead(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-2">
                {getSourceBadge(selectedLead.source)}
                {getTemperatureBadge(selectedLead.lead_temperature)}
                <span className="text-xs text-slate-400 font-mono">
                  Lead Score: <strong className="text-white">{selectedLead.lead_score}/100</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {selectedLead.student_name}
              </h2>
              <p className="text-xs text-blue-400 font-medium mt-0.5">
                Target Program: {selectedLead.course_name || 'General Admission Inquiry'}
              </p>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Dual Assessment Card: Academic Qualification vs Lead Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Academic Qualification
                  </span>
                  <div className="flex items-center gap-2">
                    {getQualificationBadge(selectedLead.academic_qualification)}
                    <span className="text-xs font-mono text-slate-300">
                      {selectedLead.percentage ? `${selectedLead.percentage}% Score` : 'Pending Verification'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {selectedLead.qualification_status || 'Subject to formal admissions committee review.'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Lead Priority / Commercial Intent
                  </span>
                  <div className="flex items-center gap-2">
                    {getTemperatureBadge(selectedLead.lead_temperature)}
                    <span className="text-xs font-bold text-white">
                      Priority Score: {selectedLead.lead_score}/100
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {selectedLead.lead_temperature === 'HOT' 
                      ? 'High commercial intent and financial alignment. Counselor follow-up recommended.'
                      : 'Nurture candidate with program details and scholarship counseling.'}
                  </p>
                </div>
              </div>

              {/* Contact & Family Info Grid */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
                <h4 className="font-semibold text-white uppercase text-[11px] tracking-wider">
                  Student Profile & Financial Details
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Mobile Number:</span>
                    <span className="font-mono font-bold text-white flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-blue-400" /> {selectedLead.mobile_number}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Father's Name:</span>
                    <span className="font-medium text-white block mt-0.5">
                      {selectedLead.father_name || 'Not Provided'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Annual Family Income:</span>
                    <span className="font-mono font-bold text-emerald-400 block mt-0.5">
                      {selectedLead.annual_income || 'Not Disclosed'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Intake Year:</span>
                    <span className="font-medium text-white block mt-0.5">
                      {selectedLead.admission_year || '2026'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Hostel Required:</span>
                    <span className="font-medium text-white block mt-0.5">
                      {selectedLead.hostel_required || 'No'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Entrance Exam:</span>
                    <span className="font-medium text-purple-300 block mt-0.5">
                      {selectedLead.entrance_exam ? `${selectedLead.entrance_exam} (${selectedLead.entrance_score})` : 'None / Direct'}
                    </span>
                  </div>

                  {selectedLead.email && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px] uppercase">Email:</span>
                      <span className="font-mono text-slate-300 block mt-0.5">
                        {selectedLead.email}
                      </span>
                    </div>
                  )}

                  {selectedLead.city && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Location:</span>
                      <span className="text-slate-300 block mt-0.5">
                        {selectedLead.city}, {selectedLead.state}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scoring Factors Breakdown */}
              {selectedLead.lead_factors && selectedLead.lead_factors.length > 0 && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="font-semibold text-white uppercase text-[11px] tracking-wider">
                    Positive Lead Scoring Signals
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedLead.lead_factors.map((factor, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                <span>Record Created: {new Date(selectedLead.created_at).toLocaleString()}</span>
                <span>Source: {selectedLead.source}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
