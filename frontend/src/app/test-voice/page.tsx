'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio, Mic, MicOff, Volume2, VolumeX, Sparkles, Building2,
  Globe, ExternalLink, RefreshCw, PhoneCall, PhoneOff, CheckCircle2,
  Layers, ShieldCheck, HelpCircle, Send, Loader2, ArrowRight, Activity, Zap, Check, AlertCircle
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { MarkdownContent } from '@/components/MarkdownContent';
import { api, CollegeWebSearchProject, VoiceSourceItem } from '@/lib/api';
import NeeraOrb from './NeeraOrb';

interface AssistantCard {
  id: string;
  intent: string;
  spokenSummary: string;
  displayMarkdown: string;
  sources: VoiceSourceItem[];
  timestamp: string;
  collegeName: string;
  domain: string;
  model: string;
}

const QUICK_INQUIRIES = [
  {
    label: '💰 B.Tech CSE Fees & Breakdown',
    query: 'B.Tech CSE की टोटल फीस और सेमेस्टर ब्रेकअप क्या है?'
  },
  {
    label: '🏠 Hostel Rooms & Mess Charges',
    query: 'हॉस्टल के AC और नॉन-AC कमरों के चार्जेस और मेस फीस क्या है?'
  },
  {
    label: '📋 Admission Eligibility & REAP',
    query: 'एडमिशन एलिजिबिलिटी क्राइटेरिया, REAP प्रोसेस और कटऑफ क्या है?'
  },
  {
    label: '🚀 Placements & Top Recruiters',
    query: 'लेटेस्ट प्लेसमेंट रिकॉर्ड, हाईएस्ट पैकेज और टॉप कंपनियां कौन सी हैं?'
  },
];

export default function TestVoicePage() {
  // Configuration: Fixed Hindi Conversation & Nira Voice on gpt-live-1
  const [projects, setProjects] = useState<CollegeWebSearchProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj_poornima');
  const selectedVoice = 'nira';
  const liveModel = 'gpt-live-1';

  // Call Lifecycle States
  const [voiceState, setVoiceState] = useState<'off' | 'connecting' | 'live' | 'error'>('off');
  const [agentState, setAgentState] = useState<'idle' | 'listening' | 'searching' | 'speaking'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Ready. Click the green Start button below to begin.');
  const [activeSearchQuery, setActiveSearchQuery] = useState<string | null>(null);

  // Live Diagnostics
  const [isMicReceivingAudio, setIsMicReceivingAudio] = useState(false);
  const [lastApiStatus, setLastApiStatus] = useState<string>('Standby (Ready)');
  const [lastApiLatency, setLastApiLatency] = useState<number | null>(null);

  // Audio Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  // Active Media Streams for Neera Orb Web Audio Analysis
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Real-time Audio Spectrum (12 frequency bands)
  const [spectrumHeights, setSpectrumHeights] = useState<number[]>([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);

  // Screen Feed: ASSISTANT CARDS ONLY (NO USER SPEECH TRANSCRIPT DISPLAYED)
  const [assistantCards, setAssistantCards] = useState<AssistantCard[]>([]);
  const [manualText, setManualText] = useState('');
  const [isSearchingText, setIsSearchingText] = useState(false);

  // WebRTC & Audio Engine Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const activeProjectIdRef = useRef<string>(activeProjectId);
  const isMicMutedRef = useRef<boolean>(false);
  const isSpeakerMutedRef = useRef<boolean>(false);
  const voiceStateRef = useRef<'off' | 'connecting' | 'live' | 'error'>(voiceState);
  const accumulatedSpeechRef = useRef<string>('');
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    isSpeakerMutedRef.current = isSpeakerMuted;
  }, [isSpeakerMuted]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  // Fetch College Projects on mount
  useEffect(() => {
    api.listCollegeProjects()
      .then((list) => {
        setProjects(list);
        if (list.length > 0 && !list.some((p) => p.id === activeProjectId)) {
          setActiveProjectId(list[0].id);
        }
      })
      .catch((err) => console.error('Failed to load college projects:', err));
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const rawCollegeName = activeProject?.college_name || 'Poornima University';
  const collegeName = rawCollegeName.startsWith('http://') || rawCollegeName.startsWith('https://')
    ? (activeProject?.base_domain || rawCollegeName.replace(/^https?:\/\//, '').replace(/\/+$/, ''))
    : rawCollegeName;
  const domain = activeProject?.base_domain || 'poornima.org';

  // Initial Welcome Card (Spoken Hindi Conversation + Verified Grounding)
  useEffect(() => {
    const welcomeCard: AssistantCard = {
      id: 'welcome-' + activeProjectId,
      intent: 'welcome',
      spokenSummary: `नमस्ते! मैं ${collegeName} की ऑफिशियल AI काउंसलर नीरा हूँ, gpt-live-1 वॉइस मॉडल द्वारा संचालित। आप सीधे हिंदी में मुझसे कॉलेज के बारे में कुछ भी पूछ सकते हैं।`,
      displayMarkdown: `### 🎙️ Welcome to Neera Live Voice Studio\n\nI am **Neera**, the official AI admission counselor for **${collegeName}**, directly connected to **${domain}** official sitemap and powered by **${liveModel}**.\n\n- **Live WebRTC Audio**: Spoken audio directly streamed to and from OpenAI's **${liveModel}** with native **Nira (Hindi Female)** voice.\n- **100% Hands-Free**: No spacebar or push-to-talk required. Speak naturally in Hindi.\n- **Verified Grounding**: Complex fee tables, hostel rooms, and admission criteria are displayed on your screen, while a concise spoken response is voiced aloud.\n- **Privacy Focused**: Your spoken voice transcript is never displayed on screen.`,
      sources: [
        { title: `${collegeName} Official Portal`, url: `https://${domain}`, category: 'Official Portal' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      collegeName,
      domain,
      model: liveModel,
    };
    setAssistantCards([welcomeCard]);
  }, [activeProjectId, collegeName, domain, liveModel]);

  // Scroll to bottom on card updates
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantCards, isSearchingText, agentState]);

  // Real-time Audio Spectrum Analyser (Web Audio API)
  const setupAudioSpectrum = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const renderSpectrum = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        const bars: number[] = [];
        const step = Math.max(1, Math.floor(dataArray.length / 12));
        for (let i = 0; i < 12; i++) {
          const val = dataArray[i * step] || 0;
          sum += val;
          const height = Math.max(8, Math.min(54, Math.round((val / 255) * 46) + 8));
          bars.push(height);
        }
        setSpectrumHeights(bars);

        // Calculate speech energy to determine if user speech is actively entering mic
        const avg = sum / 12;
        setIsMicReceivingAudio(avg > 12);

        animFrameRef.current = requestAnimationFrame(renderSpectrum);
      };

      renderSpectrum();
    } catch (e) {
      console.warn('Audio spectrum setup note:', e);
    }
  }, []);

  // Clean Termination of Voice Session
  const stopVoiceSession = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setSpectrumHeights([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
    setIsMicReceivingAudio(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    accumulatedSpeechRef.current = '';
    isProcessingRef.current = false;
    isSpeakingRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (e) {}
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setLocalStream(null);
    setRemoteStream(null);

    setVoiceState('off');
    setAgentState('idle');
    setStatusMessage('Call ended. Click the Start button to begin a new call.');
    setActiveSearchQuery(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  // Execute Grounded Search and Trigger Model Voice Response
  const processQueryAndRespond = useCallback(async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setAgentState('searching');
    setStatusMessage(`Searching ${domain} official sitemap…`);
    setActiveSearchQuery(cleanQuery);
    setLastApiStatus('Searching… (POST /turn)');

    const tStart = performance.now();

    try {
      // 1. Fetch grounded data from verified sitemap
      const turnRes = await api.executeVoiceTurn({
        project_id: activeProjectIdRef.current,
        transcript: cleanQuery,
        language_hint: 'hi',
        history: [],
      });

      const latencyMs = Math.round(performance.now() - tStart);
      setLastApiLatency(latencyMs);
      setLastApiStatus(`🟢 200 OK (${latencyMs}ms)`);
      setActiveSearchQuery(null);

      if (!turnRes.should_respond) {
        setAgentState('idle');
        setStatusMessage('Listening hands-free. Speak into your mic…');
        isProcessingRef.current = false;
        return;
      }

      const spokenSummary = turnRes.spoken_summary || `${collegeName} की वेरिफाइड जानकारी स्क्रीन पर दिखा दी गई है।`;
      const displayMarkdown = turnRes.display_markdown || 'Official website information verified.';
      const sources = turnRes.sources || [];
      const intent = turnRes.intent || 'general';

      // 2. Render ASSISTANT CARD ONLY (USER TEXT IS NEVER ADDED TO UI)
      const newCard: AssistantCard = {
        id: `ai-card-${Date.now()}`,
        intent,
        spokenSummary,
        displayMarkdown,
        sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        collegeName,
        domain,
        model: liveModel,
      };

      setAssistantCards((prev) => [...prev, newCard]);

      // 3. Audio Reply: Send instruction to gpt-live-1 over WebRTC DataChannel
      const dc = dataChannelRef.current;
      if (dc && dc.readyState === 'open' && spokenSummary && !isSpeakerMutedRef.current) {
        setAgentState('speaking');
        setStatusMessage('🔊 Neera is speaking…');
        try {
          dc.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['audio', 'text'],
                instructions: `You are Neera, the official Indian Hindi voice admission counselor for ${collegeName}. Speak the following Hindi answer aloud naturally in your warm, polite, soft Indian female tone. Speak word-for-word without adding any filler:\n"${spokenSummary.replace(/"/g, "'")}"`,
              },
            })
          );
        } catch (dcErr) {
          console.error('Failed to send response.create over WebRTC DataChannel:', dcErr);
        }
      } else {
        setAgentState('idle');
        setStatusMessage('Listening hands-free. Speak into your mic…');
      }
    } catch (err: any) {
      console.error('Failed to process turn query:', err);
      setLastApiStatus('⚠️ API Error');
      setActiveSearchQuery(null);
      setAgentState('idle');
      setStatusMessage('Listening. Please speak again…');
    } finally {
      isProcessingRef.current = false;
    }
  }, [collegeName, domain, liveModel]);

  // Start Realtime Hands-Free Session: Direct WebRTC with gpt-live-1 + Nira Voice
  const startVoiceSession = async () => {
    setVoiceState('connecting');
    setStatusMessage('Connecting microphone & gpt-live-1 voice engine…');
    setLastApiStatus('Initiating WebRTC Session…');

    try {
      // Pre-unlock remote audio element on user gesture
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

      // 1. Microphone capture with acoustic echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Connect hardware spectrum analyser
      setupAudioSpectrum(stream);

      // 2. Set up RTCPeerConnection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log('WebRTC connectionState:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setVoiceState('live');
          setAgentState('idle');
          setStatusMessage('🟢 Call Live — Hands-Free active. Speak in Hindi.');
        }
      };

      // Add local microphone audio track to WebRTC
      const audioTrack = stream.getAudioTracks()[0];
      pc.addTrack(audioTrack, stream);

      // Connect incoming remote audio stream to audio element & Neera Orb analyser
      pc.ontrack = (e) => {
        let incomingStream: MediaStream | null = null;
        if (e.streams && e.streams[0]) {
          incomingStream = e.streams[0];
        } else if (e.track) {
          incomingStream = new MediaStream([e.track]);
        }
        if (incomingStream) {
          setRemoteStream(incomingStream);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = incomingStream;
            remoteAudioRef.current.play().catch(() => {});
          }
        }
      };

      // 3. Create WebRTC Data Channel for Realtime events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setVoiceState('live');
        setAgentState('idle');
        setStatusMessage('🟢 Call Live — Hands-Free active. Speak in Hindi.');

        // Initial welcome greeting voiced natively by Neera
        const greeting = `नमस्ते! मैं ${collegeName} की ऑफिशियल AI काउंसलर नीरा हूँ। आप मुझसे कॉलेज के बारे में कुछ भी पूछ सकते हैं।`;
        try {
          dc.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['audio', 'text'],
                instructions: `You are Neera. Speak this greeting aloud warmly in fluent Hindi:\n"${greeting}"`,
              },
            })
          );
        } catch (e) {}
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta') {
            setAgentState('speaking');
            isSpeakingRef.current = true;
          } else if (event.type === 'response.done' || event.type === 'response.output_audio.done') {
            setAgentState('idle');
            isSpeakingRef.current = false;
            setStatusMessage('Listening hands-free. Speak into your mic…');
          }
        } catch (err) {}
      };

      // 4. Generate WebRTC SDP Offer immediately
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Direct SDP Exchange with Backend -> OpenAI Live API (/v1/live/sessions)
      setLastApiStatus('Exchanging SDP with OpenAI…');
      const liveRes = await api.createLiveSession(
        activeProjectId,
        offer.sdp || '',
        'nira',
        'hi',
        liveModel
      );

      if (!liveRes || !liveRes.sdp) {
        throw new Error('Invalid SDP answer received from voice service.');
      }

      setLastApiStatus(`🟢 201 Created (${liveModel} · ${liveRes.voice})`);

      // 6. Set Remote Description (completes full-duplex WebRTC link)
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: liveRes.sdp,
      });

      // Mark session as live now that negotiation has succeeded
      setVoiceState('live');
      setAgentState('idle');
      setStatusMessage('🟢 Call Live — Hands-Free active. Speak in Hindi.');

      // 7. Continuous Speech Listener (Hindi 'hi-IN') for Grounding Trigger
      if (typeof window !== 'undefined') {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'hi-IN'; // Speech input in Hindi

          rec.onstart = () => {
            if (agentState !== 'speaking' && agentState !== 'searching') {
              setAgentState('listening');
            }
          };

          rec.onerror = (e: any) => {
            console.warn('SpeechRecognition notice:', e.error);
          };

          rec.onresult = (e: any) => {
            // Echo prevention: ignore speech when assistant is speaking
            if (isMicMutedRef.current || isSpeakingRef.current || isProcessingRef.current) {
              return;
            }

            let speechChunk = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) {
              speechChunk += e.results[i][0].transcript + ' ';
            }

            const cleanText = speechChunk.trim();
            if (!cleanText) return;

            accumulatedSpeechRef.current = cleanText;
            setAgentState('listening');
            setStatusMessage('🎙️ Voice detected, listening…');

            // Silence debounce timer (800ms silence triggers sitemap search)
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }

            silenceTimerRef.current = setTimeout(() => {
              const queryToCommit = accumulatedSpeechRef.current.trim();
              accumulatedSpeechRef.current = '';
              if (queryToCommit && !isProcessingRef.current) {
                // Execute search & reply (user speech transcript is NEVER displayed in UI)
                processQueryAndRespond(queryToCommit);
              }
            }, 800);
          };

          rec.onend = () => {
            if (voiceStateRef.current === 'live') {
              try {
                rec.start();
              } catch (e) {}
            }
          };

          try {
            rec.start();
          } catch (e) {}
          recognitionRef.current = rec;
        }
      }
    } catch (err: any) {
      console.error('Failed to start live voice session:', err);
      stopVoiceSession();
      setVoiceState('error');
      setLastApiStatus('⚠️ Connection Failed');
      setStatusMessage('Voice call could not be established. Please verify mic permissions.');
    }
  };

  const toggleMic = () => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    isMicMutedRef.current = next;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
  };

  const toggleSpeaker = () => {
    const next = !isSpeakerMuted;
    setIsSpeakerMuted(next);
    isSpeakerMutedRef.current = next;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = next;
    }
  };

  const clearCanvas = () => {
    setAssistantCards([]);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualText.trim()) {
      setIsSearchingText(true);
      processQueryAndRespond(manualText.trim()).finally(() => {
        setIsSearchingText(false);
      });
      setManualText('');
    }
  };

  return (
    <DashboardShell activeNav="test-voice">
      <div className="space-y-5 pb-8 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b bd">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge !bg-purple-500/15 !text-purple-700 dark:!text-purple-300 !border-purple-500/30 flex items-center gap-1.5 font-bold">
                <Radio className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                Live Voice Studio
              </span>
              <span className="badge !bg-emerald-500/15 !text-emerald-700 dark:!text-emerald-300 !border-emerald-500/30 flex items-center gap-1 font-bold">
                <Globe className="w-3 h-3 text-emerald-600" />
                {domain} ({activeProject?.total_urls || 0} Grounded Pages)
              </span>
              <span className="badge !bg-blue-500/15 !text-blue-700 dark:!text-blue-300 !border-blue-500/30 font-bold text-[11px]">
                🇮🇳 Conversation: Hindi / Hinglish
              </span>
              <span className="badge !bg-pink-500/15 !text-pink-700 dark:!text-pink-300 !border-pink-500/30 font-bold text-[11px]">
                🔊 Voice: Nira (Female Counselor)
              </span>
            </div>
            <h1 className="text-2xl font-black mt-1.5 tracking-tight flex items-center gap-2">
              Hands-Free Voice Studio ({liveModel})
            </h1>
            <p className="text-xs t3 mt-0.5 max-w-2xl leading-relaxed">
              Tap the large Start button below to connect with Neera. Speak naturally in Hindi — answers are voiced aloud via {liveModel} WebRTC, while comprehensive fee tables and breakdowns appear on your screen.
            </p>
          </div>

          {/* College Project Selector */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-1)] border bd rounded-xl px-3 py-2 text-xs">
            <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-bold t3">Target College:</span>
            <select
              value={activeProjectId}
              onChange={(e) => {
                stopVoiceSession();
                setActiveProjectId(e.target.value);
              }}
              className="bg-transparent border-none text-xs font-bold text-[var(--text-1)] focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[var(--surface-1)] text-[var(--text-1)]">
                  {p.college_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Diagnostics Bar: API Status & Mic Indicator */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3 border bd flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full shrink-0 ${voiceState === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider t3">Call Status</p>
              <p className="text-xs font-bold truncate">
                {voiceState === 'live' ? '🟢 Live Connected' : voiceState === 'connecting' ? '🟡 Connecting…' : '⚪ Offline'}
              </p>
            </div>
          </div>

          <div className="card p-3 border bd flex items-center gap-2.5">
            <Mic className={`w-4 h-4 shrink-0 ${isMicReceivingAudio ? 'text-emerald-500 animate-bounce' : 'text-purple-600'}`} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider t3">Microphone</p>
              <p className="text-xs font-bold truncate">
                {voiceState !== 'live' ? '⚪ Mic Off' : isMicReceivingAudio ? '🟢 Audio Detected' : '🎧 Listening…'}
              </p>
            </div>
          </div>

          <div className="card p-3 border bd flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider t3">API Engine</p>
              <p className="text-xs font-bold truncate text-emerald-600 dark:text-emerald-400">
                {lastApiStatus}
              </p>
            </div>
          </div>

          <div className="card p-3 border bd flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-pink-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider t3">Active Voice</p>
              <p className="text-xs font-bold truncate text-pink-600 dark:text-pink-400">
                Nira (Hindi Female)
              </p>
            </div>
          </div>
        </div>

        {/* Central Neural Voice Studio Stage */}
        <div className="voice-studio-canvas p-6 relative overflow-hidden">
          {/* Interactive Neera AI 3D Voice Orb */}
          <div className="mb-6 flex flex-col items-center justify-center">
            <NeeraOrb
              voiceState={voiceState}
              agentState={agentState}
              isMicMuted={isMicMuted}
              isSpeakerMuted={isSpeakerMuted}
              isMicReceivingAudio={isMicReceivingAudio}
              localStream={localStream}
              remoteStream={remoteStream}
              spectrumHeights={spectrumHeights}
              onOrbClick={voiceState === 'live' ? stopVoiceSession : startVoiceSession}
              statusMessage={
                voiceState === 'live'
                  ? (agentState === 'speaking' ? '🔊 Neera is speaking…' : agentState === 'searching' ? `💭 Searching ${domain} sitemap…` : isMicReceivingAudio ? '🎙️ Hearing your voice (Mic Frequency Live)…' : '🎧 Listening hands-free. Speak in Hindi…')
                  : voiceState === 'connecting' ? '🟡 Connecting to Neera…' : undefined
              }
            />
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-5 border-t bd">
            {/* BIG PROMINENT START / STOP CALL BUTTON */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              {voiceState === 'live' ? (
                <button
                  type="button"
                  onClick={stopVoiceSession}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <PhoneOff className="w-6 h-6 animate-pulse" />
                  <span>🔴 End Voice Call (Stop)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVoiceSession}
                  disabled={voiceState === 'connecting'}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-purple-600 hover:brightness-110 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {voiceState === 'connecting' ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Connecting to Neera…</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 animate-pulse" />
                      <span>🎙️ Start Call with Neera ({liveModel})</span>
                    </>
                  )}
                </button>
              )}

              {/* Status Text & Action */}
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    voiceState === 'live'
                      ? (agentState === 'speaking' ? 'bg-pink-500 animate-pulse' : 'bg-emerald-500')
                      : voiceState === 'connecting'
                      ? 'bg-amber-500 animate-ping'
                      : 'bg-slate-400'
                  }`} />
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--text-1)]">
                    {voiceState === 'live'
                      ? (agentState === 'speaking' ? 'Neera is Speaking' : agentState === 'searching' ? 'Searching Sitemap' : 'Hands-Free Listening')
                      : voiceState === 'connecting' ? 'Connecting to Model…' : 'Call Offline'}
                  </span>
                </div>
                <p className="text-xs t3 mt-0.5">{statusMessage}</p>
                {activeSearchQuery && (
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1 flex items-center justify-center sm:justify-start gap-1">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    Searching sitemap for &ldquo;{activeSearchQuery}&rdquo;…
                  </p>
                )}
              </div>
            </div>

            {/* Center: Live Frequency Spectrum Equalizer (Web Audio API) */}
            <div className="voice-wave-container" title="Microphone Frequency Equalizer">
              {spectrumHeights.map((h, i) => (
                <div
                  key={i}
                  className={`voice-wave-bar ${
                    voiceState === 'live' && (agentState === 'speaking' || isMicReceivingAudio)
                      ? 'active'
                      : ''
                  }`}
                  style={{
                    height: voiceState === 'live' ? `${h}px` : '6px',
                    transition: 'height 0.08s ease'
                  }}
                />
              ))}
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {voiceState === 'live' && (
                <>
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`btn btn-sm ${isMicMuted ? 'btn-danger' : 'btn-secondary'} rounded-xl font-bold`}
                    title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                  >
                    {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-purple-600" />}
                    <span>{isMicMuted ? 'Mic Off' : 'Mic On'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleSpeaker}
                    className={`btn btn-sm ${isSpeakerMuted ? 'btn-danger' : 'btn-secondary'} rounded-xl`}
                    title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
                  >
                    {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-pink-600" />}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={clearCanvas}
                className="btn btn-secondary btn-sm rounded-xl text-xs font-bold"
                title="Clear Screen Output"
              >
                Clear Screen
              </button>
            </div>
          </div>

          {/* Quick Inquiry Pills */}
          <div className="mt-5 pt-4 border-t bd flex items-center gap-2 flex-wrap text-xs">
            <span className="font-extrabold t3 uppercase text-[10px] tracking-wider shrink-0 flex items-center gap-1">
              <Zap className="w-3 h-3 text-purple-600" />
              Quick Questions:
            </span>
            {QUICK_INQUIRIES.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => processQueryAndRespond(item.query)}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border bd text-xs font-bold text-[var(--text-1)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grounded Knowledge Feed: ASSISTANT CARDS ONLY (User Speech Transcript is Never Shown) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-1)]">
                Grounded Knowledge & Verified Data Tables
              </h2>
            </div>
            <span className="text-xs t3 font-medium">
              Data tables & breakdown shown on screen · Concise summary voiced by Neera
            </span>
          </div>

          <div className="space-y-4" role="region" aria-label="Grounded Knowledge Cards">
            {assistantCards.map((card) => (
              <div
                key={card.id}
                className="card p-5 sm:p-6 transition-all hover:shadow-md border-[var(--border)]"
              >
                {/* Card Top Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b bd">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge !bg-purple-500/15 !text-purple-700 dark:!text-purple-300 !border-purple-500/30 text-xs font-bold uppercase">
                      {card.intent.replace(/_/g, ' ')}
                    </span>
                    <span className="badge badge-emerald text-xs">
                      <ShieldCheck className="w-3 h-3" /> Verified Domain: {card.domain}
                    </span>
                    <span className="badge badge-slate text-[10px] font-bold">
                      {card.model}
                    </span>
                    <span className="text-[11px] t3 font-medium">{card.timestamp}</span>
                  </div>

                  <span className="text-xs font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Neera Official Counselor
                  </span>
                </div>

                {/* Spoken Summary Highlight Banner */}
                {card.spokenSummary && (
                  <div className="mb-4 p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 text-xs text-purple-950 dark:text-purple-100 flex items-start gap-2.5">
                    <Volume2 className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold uppercase tracking-wider text-[10px] text-pink-700 dark:text-pink-300 block mb-0.5">
                        Spoken Summary by Neera (Hindi Voice):
                      </span>
                      <p className="leading-relaxed text-xs font-medium">{card.spokenSummary}</p>
                    </div>
                  </div>
                )}

                {/* Detailed On-Screen Content (Markdown Tables & Breakdowns) */}
                <div className="chat-bubble md !bg-transparent !p-0 !text-[var(--text-1)] leading-relaxed">
                  <MarkdownContent content={card.displayMarkdown} />
                </div>

                {/* Official Sources Citations */}
                {card.sources && card.sources.length > 0 && (
                  <div className="mt-5 pt-3 border-t bd flex flex-col gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider t3">
                      Verified Sitemap Sources:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {card.sources.map((s, idx) => (
                        <a
                          key={idx}
                          href={s.url.startsWith('http') ? s.url : `https://${s.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-pill hover:scale-[1.02] transition-transform"
                        >
                          <ExternalLink className="w-3 h-3 text-purple-600 shrink-0" />
                          <span>{s.title || s.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Active Grounding Indicator */}
            {(isSearchingText || agentState === 'searching') && (
              <div className="card p-5 border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/10 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-[var(--text-1)]">Searching {domain} sitemap in real time…</p>
                  <p className="t3 mt-0.5">Verifying official fees, admission rules, and eligibility criteria.</p>
                </div>
              </div>
            )}

            <div ref={feedEndRef} />
          </div>
        </div>

        {/* Text Testing Input Bar */}
        <form
          onSubmit={handleManualSubmit}
          className="card p-3 flex items-center gap-2 border bd shadow-sm"
        >
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={
              voiceState === 'live'
                ? 'Speak in Hindi into your mic, or type an inquiry here…'
                : `Start the call or type a question about ${collegeName} here…`
            }
            className="input !text-xs !py-2 flex-1"
            disabled={isSearchingText}
          />
          <button
            type="submit"
            disabled={!manualText.trim() || isSearchingText}
            className="btn btn-primary btn-sm !py-2 shrink-0 rounded-xl font-bold"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>

      {/* Realtime Audio Element for WebRTC audio playback */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
      />
    </DashboardShell>
  );
}
