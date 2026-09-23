'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, ExternalLink, Loader2, Sparkles, Activity,
  Flame, Calendar, Clock, CheckCircle2, ChevronDown, ChevronUp,
  GraduationCap, BookOpen, UserCheck, PhoneCall, Building, AlertCircle,
  HelpCircle, ShieldAlert, Award, FileText
} from 'lucide-react';
import {
  api, Citation, DebugTrace, LeadScore, EnrollmentPrediction,
  BookingSlot, BookingResponse, AdmissionLead, CallbackRequest
} from '@/lib/api';
import { MarkdownContent } from '@/components/MarkdownContent';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  debug_trace?: DebugTrace;
  lead_score?: LeadScore;
  enrollment_prediction?: EnrollmentPrediction;
  admission_lead?: AdmissionLead;
  apply_url?: string;
  management_quota_url?: string;
  suggested_actions?: string[];
  booking_slots?: BookingSlot[];
  timestamp: string;
}

interface ChatInterfaceProps {
  agentId: string;
  agentName: string;
  welcomeMessage: string;
  primaryColor?: string;
  detectedSector?: string;
}

export default function ChatInterface({
  agentId,
  agentName,
  welcomeMessage,
  primaryColor = '#3B82F6',
  detectedSector = 'college',
}: ChatInterfaceProps) {
  const isEducation = detectedSector === 'college' || detectedSector === 'education';

  // Mode Selection: 'student' (Primary / Admission Lead Gen) vs 'teacher' (Secondary)
  const [mode, setMode] = useState<'student' | 'teacher'>('student');

  const getStudentWelcome = () =>
    `👋 Welcome to **${agentName}** Admission Portal!

I am your dedicated Admissions Assistant. I can help you check course eligibility, cutoffs, tuition fees, scholarships, and guide your 2026 application process.

👉 *To check your direct eligibility or scholarship slab, what course are you interested in and what was your 12th/Graduation percentage?*`;

  const getTeacherWelcome = () =>
    `👨‍🏫 Welcome to **${agentName}** Faculty & Staff Assistant!

I can help faculty members with academic calendars, exam duty regulations, leave policies, syllabus blueprints, and internal guidelines.`;

  const getSuggestedActions = (currentMode: 'student' | 'teacher') => {
    if (!isEducation) {
      return ['What services do you provide?', 'Contact Information', 'Pricing & Details'];
    }
    if (currentMode === 'student') {
      return [
        'B.Tech CSE Eligibility & Fees',
        'Direct Admission / Management Quota',
        'Scholarships for 2026 Batch',
        'Hostel & Campus Facilities',
        'Talk to Admission Counselor'
      ];
    }
    return [
      'Faculty Leave Policy',
      'Semester Exam Regulations',
      'Research & Conference Grants',
      'AICTE / Syllabus Guidelines'
    ];
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: isEducation ? getStudentWelcome() : welcomeMessage,
      suggested_actions: getSuggestedActions('student'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  // Live Admission Lead Tracking State
  const [activeLead, setActiveLead] = useState<AdmissionLead | null>(null);
  const [currentLeadScore, setCurrentLeadScore] = useState<LeadScore | null>(null);
  const [currentEnrollmentPred, setCurrentEnrollmentPred] = useState<EnrollmentPrediction | null>(null);

  // Counselor Callback Modal State
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);
  const [cbName, setCbName] = useState('');
  const [cbPhone, setCbPhone] = useState('');
  const [cbCourse, setCbCourse] = useState('B.Tech Computer Science');
  const [cbTime, setCbTime] = useState('Today (within 2 hours)');
  const [cbLoading, setCbLoading] = useState(false);
  const [cbSuccess, setCbSuccess] = useState<CallbackRequest | null>(null);

  // Management Quota Inquiry Modal State
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);

  // Booking Modal State (Calendar/Campus Tour)
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [bookingName, setBookingName] = useState('Faizan Mansuri');
  const [bookingEmail, setBookingEmail] = useState('faizan@example.com');
  const [bookingPhone, setBookingPhone] = useState('+91 98765 43210');
  const [bookingCourse, setBookingCourse] = useState('B.Tech Computer Science');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<BookingResponse | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, expandedTraceId, bookingSuccess, cbSuccess]);

  // Handle Mode Change
  const handleModeChange = (newMode: 'student' | 'teacher') => {
    setMode(newMode);
    setMessages([
      {
        id: 'welcome-' + newMode,
        role: 'assistant',
        content: newMode === 'student' ? getStudentWelcome() : getTeacherWelcome(),
        suggested_actions: getSuggestedActions(newMode),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => !m.id.startsWith('welcome'))
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.chatWithAgent(agentId, messageContent, history, mode, debugMode);

      if (res.admission_lead) {
        setActiveLead(res.admission_lead);
        if (res.admission_lead.student_name && !cbName) {
          setCbName(res.admission_lead.student_name);
        }
        if (res.admission_lead.mobile_number && !cbPhone) {
          setCbPhone(res.admission_lead.mobile_number);
        }
        if (res.admission_lead.course_name) {
          setCbCourse(res.admission_lead.course_name);
        }
      }

      if (res.lead_score) {
        setCurrentLeadScore(res.lead_score);
      }
      if (res.enrollment_prediction) {
        setCurrentEnrollmentPred(res.enrollment_prediction);
      }

      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        debug_trace: res.debug_trace,
        lead_score: res.lead_score,
        enrollment_prediction: res.enrollment_prediction,
        admission_lead: res.admission_lead,
        apply_url: res.apply_url,
        management_quota_url: res.management_quota_url,
        suggested_actions: res.suggested_actions,
        booking_slots: res.booking_slots,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
      if (res.debug_trace) {
        setExpandedTraceId(botMessageId);
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an issue generating a response. Please verify the agent status or try asking again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbName || !cbPhone) return;
    setCbLoading(true);
    try {
      const res = await api.requestCallback(agentId, {
        student_name: cbName,
        mobile_number: cbPhone,
        course: cbCourse,
        preferred_time: cbTime,
        lead_id: activeLead?.id,
      });
      setCbSuccess(res);
    } catch (err) {
      console.error(err);
    } finally {
      setCbLoading(false);
    }
  };

  const handleBookSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setBookingLoading(true);
    try {
      const res = await api.bookSlot(agentId, {
        slot_id: selectedSlot.id,
        name: bookingName,
        email: bookingEmail,
        phone: bookingPhone,
        course_interest: bookingCourse
      });
      setBookingSuccess(res);
    } catch (err) {
      console.error(err);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[780px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Top Bar with Mode Switcher */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/95 flex flex-wrap items-center justify-between gap-3">
        {/* Left Identity & Mode Selection */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {mode === 'student' ? <GraduationCap className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-sm">{agentName}</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {isEducation ? '🎓 Education Platform' : `${detectedSector} sector`}
              </span>
            </div>

            {/* Mode Switcher Tabs */}
            {isEducation && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => handleModeChange('student')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    mode === 'student'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Student (Admission Mode)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('teacher')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    mode === 'teacher'
                      ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Teacher (Faculty Mode)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Debug Mode Toggle */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
              debugMode
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Inspect real-time Intent, Entity detection, Applied Filters, and Reranking scores"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Trace RAG</span>
            <span className={`w-1.5 h-1.5 rounded-full ${debugMode ? 'bg-white' : 'bg-slate-500'}`}></span>
          </button>

          {/* Quick Counselor Callback Button */}
          {isEducation && (
            <button
              onClick={() => {
                setCbSuccess(null);
                setCallbackModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Talk to Counselor</span>
            </button>
          )}

          <button
            onClick={() => {
              setMessages([
                {
                  id: 'welcome-' + mode,
                  role: 'assistant',
                  content: mode === 'student' ? getStudentWelcome() : getTeacherWelcome(),
                  suggested_actions: getSuggestedActions(mode),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
              setActiveLead(null);
              setCurrentLeadScore(null);
              setCurrentEnrollmentPred(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* LIVE ADMISSION LEAD QUALIFICATION & PRIORITY BANNER */}
      {isEducation && mode === 'student' && activeLead && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-blue-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Lead Profile:</span>
            {activeLead.student_name && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold border border-slate-700">
                👤 {activeLead.student_name}
              </span>
            )}
            {activeLead.course_name && (
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono border border-blue-500/30">
                📚 {activeLead.course_name}
              </span>
            )}
            {activeLead.percentage !== undefined && activeLead.percentage !== null && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                📊 {activeLead.percentage}%
              </span>
            )}
            {activeLead.annual_income && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/30">
                💰 {activeLead.annual_income}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Academic Qualification Status */}
            <span className={`px-2 py-0.5 rounded font-bold font-mono text-[11px] flex items-center gap-1 ${
              activeLead.academic_qualification === 'ELIGIBLE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              {activeLead.academic_qualification === 'ELIGIBLE' ? '✓ Eligible' : '⚡ Needs Review'}
            </span>

            {/* Lead Commercial Priority */}
            <span className={`px-2.5 py-0.5 rounded font-bold font-mono text-[11px] flex items-center gap-1 ${
              activeLead.lead_temperature === 'HOT'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse'
                : activeLead.lead_temperature === 'WARM'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
            }`}>
              <Flame className="w-3.5 h-3.5" />
              {activeLead.lead_temperature} ({activeLead.lead_score}/100)
            </span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-2 ${
              msg.role === 'user' ? 'ml-auto items-end max-w-[85%]' : 'mr-auto items-start max-w-[90%]'
            }`}
          >
            <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                  msg.role === 'user' ? 'bg-indigo-600' : isEducation ? (mode === 'student' ? 'bg-blue-600' : 'bg-indigo-600') : 'bg-slate-700'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : isEducation ? (
                  mode === 'student' ? <GraduationCap className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div className="space-y-2">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                  }`}
                >
                  <MarkdownContent
                    content={msg.content}
                    isUser={msg.role === 'user'}
                    className={msg.role === 'user' ? 'text-white' : 'text-slate-200'}
                  />

                  {/* ADMISSION CTAs STRIP (for Student Mode) */}
                  {isEducation && mode === 'student' && msg.role === 'assistant' && (
                    <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                      <a
                        href={msg.apply_url || 'https://www.xyzcollege.edu.in/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Apply Now (Official)</span>
                      </a>

                      <button
                        onClick={() => {
                          setCbSuccess(null);
                          setCallbackModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Talk to Counselor</span>
                      </button>

                      <button
                        onClick={() => setQuotaModalOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Building className="w-3.5 h-3.5 text-purple-300" />
                        <span>Explore Management Quota</span>
                      </button>
                    </div>
                  )}

                  {/* Contextual Quick Action Pills inside Bot message */}
                  {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-400 font-semibold block mb-2">Suggested Inquiries:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggested_actions.map((act, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if (act === 'Talk to Admission Counselor' || act === 'Book Counselor Call') {
                                setCbSuccess(null);
                                setCallbackModalOpen(true);
                              } else if (act === 'Direct Admission / Management Quota') {
                                setQuotaModalOpen(true);
                              } else {
                                handleSend(act);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-blue-300 hover:text-blue-200 transition-all text-left"
                          >
                            {act}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Citations Box with REAL WEBSITE vs DEMO DATA Tags */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Grounded Source Citations:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite, idx) => {
                          const isDemo = cite.source_type === 'DEMO_DATA' || cite.source_type === 'DEMO_DOCUMENT' || cite.url.includes('demo.university.internal');
                          return (
                            <a
                              key={idx}
                              href={isDemo ? '#demo' : cite.url}
                              target={isDemo ? '_self' : '_blank'}
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all group ${
                                isDemo
                                  ? 'bg-purple-950/40 border-purple-500/30 text-purple-300 hover:border-purple-400'
                                  : 'bg-slate-950 border-slate-800 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300'
                              }`}
                              title={cite.snippet}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-purple-400' : 'bg-emerald-400'}`}></span>
                              <span className="truncate max-w-[200px]">{cite.title || cite.url}</span>
                              <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono ${
                                isDemo ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                              }`}>
                                {isDemo ? 'DEMO' : 'REAL WEB'}
                              </span>
                              {!isDemo && <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0" />}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`text-[10px] text-slate-500 px-1 ${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>

            {/* LIVE KNOWLEDGE RETRIEVAL DEBUG ACCORDION */}
            {msg.debug_trace && (
              <div className="w-full bg-slate-950 border border-purple-500/30 rounded-xl overflow-hidden shadow-lg mt-1">
                <button
                  onClick={() =>
                    setExpandedTraceId(expandedTraceId === msg.id ? null : msg.id)
                  }
                  className="w-full px-4 py-2.5 bg-purple-950/30 border-b border-purple-500/20 flex items-center justify-between text-xs text-purple-300 font-semibold hover:bg-purple-950/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span>Knowledge Retrieval Pipeline Trace</span>
                    <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[10px] font-mono">
                      Intent: {msg.debug_trace.detected_intent}
                    </span>
                  </div>
                  {expandedTraceId === msg.id ? (
                    <ChevronUp className="w-4 h-4 text-purple-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-purple-400" />
                  )}
                </button>

                {expandedTraceId === msg.id && (
                  <div className="p-4 space-y-3 text-xs text-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-slate-800">
                      <div>
                        <span className="text-slate-500 font-medium block">Detected Intent:</span>
                        <span className="text-blue-400 font-mono font-bold">
                          {msg.debug_trace.detected_intent}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Detected Entity:</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {msg.debug_trace.detected_entity || msg.debug_trace.detected_entity_type || 'None'}
                        </span>
                      </div>
                    </div>

                    {msg.debug_trace.matched_structured_entities && msg.debug_trace.matched_structured_entities.length > 0 && (
                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">
                          Matched Structured Records:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.debug_trace.matched_structured_entities.map((ent, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-mono"
                            >
                              {ent}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-slate-400 font-semibold block mb-2">
                        Reranked Chunks & Similarity Scores:
                      </span>
                      <div className="space-y-2">
                        {msg.debug_trace.reranked_chunks && msg.debug_trace.reranked_chunks.map((chk, i) => {
                          const isDemo = chk.source_type === 'DEMO_DATA' || chk.source_type === 'DEMO_DOCUMENT' || chk.url.includes('demo.university.internal');
                          return (
                            <div
                              key={i}
                              className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-200 font-medium truncate max-w-[280px]">
                                  {chk.title}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] uppercase ${
                                    isDemo ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                                  }`}>
                                    {isDemo ? 'DEMO' : 'REAL WEB'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Score: {(chk.score * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                                {chk.snippet}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 mr-auto max-w-[80%]">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {mode === 'student' ? <GraduationCap className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-sm flex items-center gap-2 rounded-tl-none">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Searching college knowledge base & evaluating admission qualification...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={
              mode === 'student'
                ? "Ask about B.Tech eligibility, fees, management quota, cutoffs, hostel..."
                : "Ask about faculty leave policies, examination rules, research grants, syllabus..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* COUNSELOR CALLBACK MODAL */}
      {callbackModalOpen && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span>Request Admission Counselor Callback</span>
              </div>
              <button
                onClick={() => setCallbackModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            {cbSuccess ? (
              <div className="space-y-3 text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">Callback Request Logged!</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Our Senior Admission Counselor will call <strong className="text-white">{cbSuccess.student_name}</strong> at <strong className="text-emerald-400">{cbSuccess.mobile_number}</strong> for {cbSuccess.course}.
                </p>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs font-mono space-y-1">
                  <div><span className="text-slate-500">Request ID:</span> <span className="text-emerald-400 font-bold">{cbSuccess.id}</span></div>
                  <div><span className="text-slate-500">Preferred Window:</span> {cbSuccess.preferred_time}</div>
                  <div><span className="text-slate-500">Status:</span> <span className="text-blue-400 uppercase font-bold">{cbSuccess.status}</span></div>
                </div>
                <button
                  onClick={() => setCallbackModalOpen(false)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCallbackSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Student / Parent Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={cbName}
                    onChange={(e) => setCbName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Mobile / WhatsApp Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={cbPhone}
                    onChange={(e) => setCbPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Target Course</label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech Computer Science & Engineering"
                    value={cbCourse}
                    onChange={(e) => setCbCourse(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Preferred Time for Call</label>
                  <select
                    value={cbTime}
                    onChange={(e) => setCbTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Immediately / Next 30 Mins">Immediately (Next 30 Mins)</option>
                    <option value="Today Morning (10:00 AM - 1:00 PM)">Today Morning (10:00 AM - 1:00 PM)</option>
                    <option value="Today Afternoon (2:00 PM - 5:00 PM)">Today Afternoon (2:00 PM - 5:00 PM)</option>
                    <option value="Tomorrow Morning">Tomorrow Morning</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={cbLoading || !cbName || !cbPhone}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {cbLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm Callback Request</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MANAGEMENT QUOTA GUIDANCE MODAL */}
      {quotaModalOpen && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Building className="w-4 h-4 text-purple-400" />
                <span>Management / Direct Admission Quota</span>
              </div>
              <button
                onClick={() => setQuotaModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl space-y-1">
                <div className="font-semibold text-purple-200 text-sm">Direct Admission & Quota Policy:</div>
                <p>
                  A designated percentage of seats across Computer Science, AI, and Engineering branches are reserved for Direct / Management Quota admissions under state regulatory norms.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5"></span>
                  <span><strong>Eligibility Review:</strong> Candidates with borderline cutoff scores or non-JEE ranks can be evaluated directly on class 12th PCM merit.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5"></span>
                  <span><strong>Seat Reservation:</strong> Branch allotment is subject to seat availability and direct counseling verification.</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => {
                    setQuotaModalOpen(false);
                    setCbSuccess(null);
                    setCallbackModalOpen(true);
                  }}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition-all text-center"
                >
                  Request Direct Quota Call
                </button>
                <button
                  onClick={() => setQuotaModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


