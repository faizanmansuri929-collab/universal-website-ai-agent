'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Volume2, Globe, Sparkles, ExternalLink, ShieldCheck,
  RefreshCw, AlertCircle, CheckCircle2, ChevronRight, Zap, PhoneOff,
  Radio, BookOpen, GraduationCap, Building2, Layers, MessageSquare,
  ArrowRight, Languages, Sparkle, FileText, Check, Lock
} from 'lucide-react';
import {
  api, CollegeWebSearchProject, VoiceSourceItem,
  VoiceSearchToolResponse
} from '@/lib/api';
import { MarkdownContent } from '@/components/MarkdownContent';

interface VoiceMessageItem {
  id: string;
  role: 'user' | 'assistant';
  spokenText?: string;
  content: string; // Detailed grounded markdown text with tables/lists
  sources?: VoiceSourceItem[];
  sources_count?: number;
  timestamp: string;
}

type VoiceState = 'ready' | 'connecting' | 'listening' | 'searching' | 'speaking' | 'error' | 'disconnected';

function CollegeVoiceSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialProjectId = searchParams.get('project_id') || '';

  // Project state
  const [projects, setProjects] = useState<CollegeWebSearchProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(initialProjectId);
  const [activeProject, setActiveProject] = useState<CollegeWebSearchProject | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Language & Voice State
  const [language, setLanguage] = useState<'en-IN' | 'hi'>('en-IN');
  const [selectedVoice, setSelectedVoice] = useState('verse'); // Verse/Alloy with Indian prompt
  const [voiceMode, setVoiceMode] = useState<'crowd_filter' | 'push_to_talk' | 'hands_free'>('crowd_filter');
  const [isPushTalking, setIsPushTalking] = useState(false);
  const isPushTalkingRef = useRef(false);

  // Proximity & Noise Gate State
  const [audioLevel, setAudioLevel] = useState<number>(0); // 0 to 100%
  const [isGateOpen, setIsGateOpen] = useState<boolean>(false);
  const [gateThresholdPct, setGateThresholdPct] = useState<number>(7); // Default 7% (balanced for room noise)
  const gateThresholdPctRef = useRef<number>(7);
  gateThresholdPctRef.current = gateThresholdPct;
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  // Realtime Voice Session State
  const [voiceState, setVoiceState] = useState<VoiceState>('disconnected');
  const [statusDetail, setStatusDetail] = useState<string>('Ready to start voice conversation');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Turn-Taking Half-Duplex State (Locks mic while bot processes, searches, or speaks until answer is completely finished)
  const [isBotResponding, setIsBotResponding] = useState<boolean>(false);
  const isBotRespondingRef = useRef<boolean>(false);
  const isToolExecutingRef = useRef<boolean>(false);
  const botFinishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceStateRef = useRef<VoiceState>('disconnected');
  voiceStateRef.current = voiceState;

  // Conversation Transcripts & Sources
  const [messages, setMessages] = useState<VoiceMessageItem[]>([]);
  const [currentAssistantText, setCurrentAssistantText] = useState<string>('');
  const [pendingToolResult, setPendingToolResult] = useState<VoiceSearchToolResponse | null>(null);

  // WebRTC & Web Audio Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const outboundTrackRef = useRef<MediaStreamTrack | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedCallIdsRef = useRef<Set<string>>(new Set());

  // Web Audio Noise Gate Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gateAnimFrameRef = useRef<number | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentAssistantText, statusDetail]);

  // Push-to-Talk Spacebar support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && voiceMode === 'push_to_talk' && voiceState !== 'disconnected' && voiceState !== 'error' && voiceState !== 'connecting') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        e.preventDefault();
        handlePushTalkStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && voiceMode === 'push_to_talk') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        e.preventDefault();
        handlePushTalkEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [voiceMode, voiceState]);

  // Load college projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      const current = projects.find(p => p.id === activeProjectId) || projects[0];
      if (current) {
        setActiveProjectId(current.id);
        setActiveProject(current);
      }
    }
  }, [activeProjectId, projects]);

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const list = await api.listCollegeProjects();
      setProjects(list);
      if (list.length > 0) {
        const targetId = initialProjectId && list.some(p => p.id === initialProjectId)
          ? initialProjectId
          : list[0].id;
        setActiveProjectId(targetId);
        setActiveProject(list.find(p => p.id === targetId) || list[0]);
      }
    } catch (err) {
      console.error('Failed to load college projects:', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  const startNoiseGate = (
    audioCtx: AudioContext,
    analyser: AnalyserNode,
    mode: 'crowd_filter' | 'push_to_talk' | 'hands_free'
  ) => {
    if (gateAnimFrameRef.current) {
      cancelAnimationFrame(gateAnimFrameRef.current);
      gateAnimFrameRef.current = null;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const holdTimeMs = 320; // 320ms hold window (closes cleanly after user stops speaking)

    const checkLevel = () => {
      if (!analyserRef.current || audioCtx.state === 'closed') return;

      analyser.getByteTimeDomainData(dataArray);
      let sumSq = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSq += norm * norm;
      }
      const rms = Math.sqrt(sumSq / dataArray.length);
      const levelPct = Math.min(100, Math.round(rms * 1000));
      setAudioLevel(levelPct);

      // Calibrated threshold from gateThresholdPct (e.g. 4% -> 0.004)
      const threshold = Math.max(0.001, (gateThresholdPctRef.current || 4) / 1000);

      if (isBotRespondingRef.current) {
        // While bot is processing, web-searching, or speaking:
        // OUTBOUND MIC MUST BE STRICTLY MUTED & GATE CLOSED!
        if (outboundTrackRef.current && outboundTrackRef.current.enabled) {
          outboundTrackRef.current.enabled = false;
        }
        setIsGateOpen(false);
      } else if (mode === 'push_to_talk') {
        const shouldBeOpen = isPushTalkingRef.current;
        if (outboundTrackRef.current && outboundTrackRef.current.enabled !== shouldBeOpen) {
          outboundTrackRef.current.enabled = shouldBeOpen;
        }
        setIsGateOpen(shouldBeOpen);
      } else if (mode === 'crowd_filter') {
        const now = Date.now();
        let shouldBeOpen = false;

        if (rms >= threshold) {
          lastSpeechTimeRef.current = now;
          shouldBeOpen = true;
        } else if (now - lastSpeechTimeRef.current < holdTimeMs) {
          // Still in speech hold window between words
          shouldBeOpen = true;
        } else {
          // Room murmur or ambient crowd below threshold -> MUTE outbound track!
          shouldBeOpen = false;
        }

        if (outboundTrackRef.current && outboundTrackRef.current.enabled !== shouldBeOpen) {
          outboundTrackRef.current.enabled = shouldBeOpen;
        }
        setIsGateOpen(shouldBeOpen);
      } else {
        // Quiet room (hands_free): continuous track unless manually muted
        const shouldBeOpen = !isMuted;
        if (outboundTrackRef.current && outboundTrackRef.current.enabled !== shouldBeOpen) {
          outboundTrackRef.current.enabled = shouldBeOpen;
        }
        setIsGateOpen(rms >= 0.012);
      }

      gateAnimFrameRef.current = requestAnimationFrame(checkLevel);
    };

    gateAnimFrameRef.current = requestAnimationFrame(checkLevel);
  };

  const handleEndSession = () => {
    if (botFinishTimeoutRef.current) {
      clearTimeout(botFinishTimeoutRef.current);
      botFinishTimeoutRef.current = null;
    }
    isBotRespondingRef.current = false;
    setIsBotResponding(false);
    isToolExecutingRef.current = false;

    if (gateAnimFrameRef.current) {
      cancelAnimationFrame(gateAnimFrameRef.current);
      gateAnimFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    gainNodeRef.current = null;
    destinationRef.current = null;
    setAudioLevel(0);
    setIsGateOpen(false);

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    if (outboundTrackRef.current) {
      outboundTrackRef.current.stop();
      outboundTrackRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      localStreamRef.current = null;
    }
    processedCallIdsRef.current.clear();
    setIsPushTalking(false);
    isPushTalkingRef.current = false;
    setVoiceState('disconnected');
    setStatusDetail(
      language === 'hi'
        ? 'वॉयस सेशन समाप्त हुआ। दोबारा बात करने के लिए स्टार्ट पर क्लिक करें।'
        : 'Voice session ended. Click Start Voice Search to speak again.'
    );
  };

  const handleEndSessionRef = useRef(handleEndSession);
  handleEndSessionRef.current = handleEndSession;

  // CRITICAL FIX: Stop voice session and mic completely when user navigates away to another page/feature
  useEffect(() => {
    return () => {
      handleEndSessionRef.current();
    };
  }, []);

  // Stop session on tab close or browser navigation
  useEffect(() => {
    const handleUnload = () => {
      handleEndSessionRef.current();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // 1-Click Room Noise Auto-Calibrator (Measures room for 1.2s and sets cutoff safely above it)
  const handleCalibrateRoom = () => {
    if (!analyserRef.current || voiceState === 'disconnected' || isCalibrating) return;

    setIsCalibrating(true);
    setStatusDetail(
      language === 'hi'
        ? '🎯 कमरे के शोर को मापा जा रहा है... 1 सेकंड शांत रहें'
        : '🎯 Measuring room ambient noise... Please stay quiet for 1s'
    );
    const samples: number[] = [];
    const interval = setInterval(() => {
      samples.push(audioLevel);
    }, 40);

    setTimeout(() => {
      clearInterval(interval);
      setIsCalibrating(false);
      if (samples.length > 0) {
        samples.sort((a, b) => a - b);
        const p85Index = Math.floor(samples.length * 0.85);
        const ambientLevel = samples[p85Index] || samples[samples.length - 1];
        // Set cutoff right above room noise
        const newCutoff = Math.min(25, Math.max(4, ambientLevel + 3));
        setGateThresholdPct(newCutoff);
        setStatusDetail(
          language === 'hi'
            ? `✅ रूम कैलिब्रेट हुआ (शोर: ${ambientLevel}%)! कटऑफ सेट: ${newCutoff}%. अब सवाल बोलें...`
            : `✅ Calibrated! Ambient noise: ${ambientLevel}%, Cutoff set to ${newCutoff}%. Speak your query...`
        );
      }
    }, 1200);
  };

  const handlePushTalkStart = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isBotRespondingRef.current) return;
    if (voiceMode !== 'push_to_talk' || voiceState === 'disconnected' || voiceState === 'connecting' || voiceState === 'error') return;
    if (isPushTalkingRef.current) return;

    isPushTalkingRef.current = true;
    setIsPushTalking(true);
    setIsGateOpen(true);

    if (outboundTrackRef.current) {
      outboundTrackRef.current.enabled = true;
    }
    setVoiceState('listening');
    setStatusDetail(
      language === 'hi' ? '🎙️ बोलिए... सवाल खत्म होने पर बटन छोड़ें' : '🎙️ Recording... Release button when you finish speaking'
    );
  };

  const handlePushTalkEnd = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (voiceMode !== 'push_to_talk') return;
    if (!isPushTalkingRef.current) return;

    isPushTalkingRef.current = false;
    setIsPushTalking(false);
    setIsGateOpen(false);

    if (outboundTrackRef.current) {
      outboundTrackRef.current.enabled = false;
    }

    isBotRespondingRef.current = true;
    setIsBotResponding(true);
    setVoiceState('searching');
    setStatusDetail(
      language === 'hi' ? '⏳ सवाल प्रोसेस किया जा रहा है... (माइक बंद है)' : '⏳ Processing speech & searching... (Mic locked)'
    );

    // Commit buffer and request model response
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
      } catch (err) {
        console.error('Failed to commit push-to-talk buffer:', err);
      }
    }
  };

  const handleStartVoice = async () => {
    if (voiceState !== 'disconnected' && voiceState !== 'error') {
      handleEndSession();
      return;
    }

    setErrorMessage('');
    processedCallIdsRef.current.clear();
    setVoiceState('connecting');
    setStatusDetail(
      language === 'hi'
        ? 'माइक्रोफ़ोन अनुमति और रियल-टाइम वॉइस सेशन शुरू हो रहा है...'
        : 'Requesting microphone permission & creating Indian tone realtime session...'
    );

    try {
      // 1. Get raw microphone stream (Keep localStreamRef unmuted so analyser always receives live audio!)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        localStreamRef.current = stream;

        // Clone mic track for WebRTC outbound transmission:
        // Cloned track has completely independent enabled state. Changing outboundTrack.enabled does NOT mute stream!
        const micTrack = stream.getAudioTracks()[0];
        const outboundTrack = micTrack.clone();
        outboundTrackRef.current = outboundTrack;

        // In Push-to-Talk or Crowd Filter, outbound WebRTC track starts muted until speech/button detected
        outboundTrack.enabled = voiceMode === 'hands_free';
      } catch (micErr: any) {
        setVoiceState('error');
        setErrorMessage(
          language === 'hi'
            ? 'माइक्रोफ़ोन अनुमति अस्वीकृत है। कृपया ब्राउज़र में माइक की अनुमति दें।'
            : 'Microphone access denied or unavailable. Please enable microphone permissions in your browser to use College Voice Search.'
        );
        setStatusDetail('Microphone permission required');
        return;
      }

      // 2. Setup Web Audio Proximity Analyser (Using the always-live local stream)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      // CRITICAL FIX: Explicitly resume AudioContext so Chrome/Edge doesn't keep it suspended
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // Voice-Band Filtering: Human vocal range is 200 Hz - 3400 Hz.
      // Highpass at 200 Hz eliminates laptop fan hum, AC rumble, and table thuds (<200 Hz)
      const highpass = audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 200;

      // Lowpass at 3400 Hz eliminates high frequency hiss and room clatter
      const lowpass = audioCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 3400;

      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 512;
      analyserNode.smoothingTimeConstant = 0.25;
      analyserRef.current = analyserNode;

      sourceNode.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyserNode);

      // Start the monitoring & noise gate loop
      startNoiseGate(audioCtx, analyserNode, voiceMode);

      // 3. Obtain short-lived ephemeral session token from backend with calibrated VAD / Mode params
      const targetVadThreshold = voiceMode === 'crowd_filter' ? 0.68 : (voiceMode === 'push_to_talk' ? 0.5 : 0.55);
      const targetSilenceMs = 650;
      const sessionData = await api.createVoiceSession(
        activeProjectId,
        selectedVoice,
        language,
        voiceMode === 'push_to_talk' ? 'push_to_talk' : 'hands_free',
        targetVadThreshold,
        targetSilenceMs
      );
      const ephemeralKey = sessionData.client_secret?.value;

      if (!ephemeralKey) {
        throw new Error('Backend did not return ephemeral client secret for OpenAI Realtime.');
      }

      // 4. Initialize WebRTC Peer Connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Attach audio element to play remote stream
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = document.createElement('audio');
        remoteAudioRef.current.autoplay = true;
      }
      pc.ontrack = (e) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
        }
      };

      // Add the CLONED outbound audio track to WebRTC!
      if (outboundTrackRef.current) {
        pc.addTrack(outboundTrackRef.current, new MediaStream([outboundTrackRef.current]));
      }

      // 5. Set up Realtime Data Channel for event handling
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setVoiceState('listening');
        if (voiceMode === 'push_to_talk') {
          setStatusDetail(
            language === 'hi'
              ? `पुश-टू-टॉक सक्रिय! ${activeProject?.college_name || 'कॉलेज'} से बात करने के लिए नीचे बटन दबाकर रखें (या Space दबाएं)।`
              : `Push-to-Talk active! Hold the button below (or Spacebar) to speak to ${activeProject?.college_name || 'the college'}.`
          );
        } else if (voiceMode === 'crowd_filter') {
          setStatusDetail(
            language === 'hi'
              ? `🛡️ क्राउड शील्ड सक्रिय! ${activeProject?.college_name || 'कॉलेज'} के बारे में अपना सवाल माइक के पास बोलें...`
              : `🛡️ Crowd Shield active! Speak your question close to microphone in Indian English or Hindi...`
          );
        } else {
          setStatusDetail(
            language === 'hi'
              ? `${activeProject?.college_name || 'कॉलेज'} वॉइस असिस्टेंट तैयार है। अपना सवाल पूछें!`
              : `Connected to ${activeProject?.college_name || 'College'} Voice Agent. Speak your question in Indian English or Hindi!`
          );
        }
      };

      dc.onclose = () => {
        setVoiceState('disconnected');
        setStatusDetail('Session disconnected.');
      };

      dc.onerror = (err) => {
        console.error('DataChannel error:', err);
      };

      dc.onmessage = async (event) => {
        try {
          const realtimeEvent = JSON.parse(event.data);
          handleRealtimeEvent(realtimeEvent, dc);
        } catch (e) {
          console.error('Failed to parse realtime event JSON:', e);
        }
      };

      // 5. Create WebRTC offer and exchange SDP with OpenAI Realtime GA Calls endpoint
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime/calls';

      const sdpResponse = await fetch(baseUrl, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });

      if (!sdpResponse.ok) {
        const sdpErr = await sdpResponse.text();
        throw new Error(`OpenAI Realtime SDP Handshake failed: ${sdpErr}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: answerSdp
      };
      await pc.setRemoteDescription(answer);

      // Connection established
      setVoiceState('listening');
      if (voiceMode === 'push_to_talk') {
        setStatusDetail(
          language === 'hi'
            ? `कनेक्टेड! बोलने के लिए होल्ड करें (या Space दबाएं)...`
            : `Connected! Hold button or press Space to speak...`
        );
      } else {
        setStatusDetail(
          language === 'hi'
            ? `कनेक्टेड! ${activeProject?.college_name || 'कॉलेज'} के बारे में अपना सवाल बोलें...`
            : `Connected! Listening for your question about ${activeProject?.college_name || 'the college'}...`
        );
      }

    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      setVoiceState('error');
      setErrorMessage(err.message || 'Failed to establish Realtime Voice WebRTC connection.');
      setStatusDetail('Connection failed. Please retry.');
      handleEndSession();
    }
  };

  const setMicrophoneMuted = (muted: boolean) => {
    if (outboundTrackRef.current) {
      outboundTrackRef.current.enabled = !muted;
    }
  };

  // Realtime Event Dispatcher
  const handleRealtimeEvent = async (event: any, dc: RTCDataChannel) => {
    console.log('[Realtime Event]', event.type, event);

    switch (event.type) {
      // User speech started
      case 'input_audio_buffer.speech_started':
        if (!isBotRespondingRef.current) {
          setVoiceState('listening');
          setStatusDetail(
            language === 'hi' ? '🎙 आपकी आवाज़ सुन रहे हैं...' : '🎙 Listening to your speech...'
          );
        }
        break;

      // Question speaking finished -> IMMEDIATELY LOCK MIC (MIC BAND)!
      case 'input_audio_buffer.speech_stopped':
        isBotRespondingRef.current = true;
        setIsBotResponding(true);
        if (outboundTrackRef.current) {
          outboundTrackRef.current.enabled = false;
        }
        setIsGateOpen(false);
        setVoiceState('searching');
        setStatusDetail(
          language === 'hi' ? '⏳ सवाल समझा जा रहा है... (माइक बंद है)' : '⏳ Processing speech... (Mic locked)'
        );
        break;

      case 'response.created':
        isBotRespondingRef.current = true;
        setIsBotResponding(true);
        if (outboundTrackRef.current) {
          outboundTrackRef.current.enabled = false;
        }
        setIsGateOpen(false);
        break;

      // User speech transcription completed
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript && event.transcript.trim()) {
          const rawText = event.transcript.trim();
          const userText = rawText.replace(/[\uFFFD\u0000-\u001F]/g, '').trim();
          const itemId = event.item_id || event.item?.id || `user_${Date.now()}`;
          const messageId = itemId.startsWith('user_') ? itemId : `user_${itemId}`;

          if (process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && (window as any).__DEBUG_VOICE__)) {
            console.log('[ASR Transcription Completed]', {
              item_id: event.item_id,
              message_id: messageId,
              transcript: userText,
              type: event.type
            });
          }

          if (userText) {
            setMessages(prev => {
              // 1. Check if a message with this exact item_id already exists (update in place)
              const existingIdx = prev.findIndex(m => m.id === messageId || m.id === itemId);
              if (existingIdx !== -1) {
                return prev.map((m, idx) => idx === existingIdx ? { ...m, content: userText } : m);
              }
              // 2. Prevent duplicate user message if immediate last message is already user with identical content
              if (prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].content === userText) {
                return prev;
              }
              // 3. Otherwise add new completed user message
              return [
                ...prev,
                {
                  id: messageId,
                  role: 'user',
                  content: userText,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ];
            });
          }
        }
        break;

      // AI Function Tool Calling: College Web Search (supports both function_call_arguments.done and output_item.done)
      case 'response.function_call_arguments.done':
      case 'response.output_item.done':
        const funcName = event.name || event.item?.name;
        const funcArgs = event.arguments || event.item?.arguments;
        const callId = event.call_id || event.item?.call_id || `call_${Date.now()}`;

        if (funcName === 'college_web_search') {
          if (processedCallIdsRef.current.has(callId)) {
            // Already processed this tool call ID to prevent double execution
            break;
          }
          processedCallIdsRef.current.add(callId);

          try {
            // Ensure mic is strictly locked while processing tool and searching
            isBotRespondingRef.current = true;
            isToolExecutingRef.current = true;
            setIsBotResponding(true);
            if (outboundTrackRef.current) {
              outboundTrackRef.current.enabled = false;
            }
            setIsGateOpen(false);
            setVoiceState('searching');

            const args = JSON.parse(funcArgs || '{}');
            const query = args.query || 'general college info';
            setStatusDetail(
              language === 'hi'
                ? `🔎 ${activeProject?.base_domain || 'कॉलेज वेबसाइट'} पर "${query}" खोजा जा रहा है... (माइक बंद है)`
                : `🔎 Searching ${activeProject?.base_domain || 'college website'} for "${query}"... (Mic locked)`
            );

            // 1. EXECUTE EXISTING COLLEGE SEARCH BACKEND ENGINE + SYNTHESIZE DETAILED TEXT
            const searchResult: VoiceSearchToolResponse = await api.executeVoiceSearchTool(
              activeProjectId,
              query,
              3,
              language
            );

            setPendingToolResult(searchResult);

            // 2. IMMEDIATELY RENDER DETAILED MARKDOWN & SOURCES CARD ON SCREEN (Chat Result Show)
            const assistantMsgId = `assistant_${Date.now()}`;
            setMessages(prev => [
              ...prev,
              {
                id: assistantMsgId,
                role: 'assistant',
                spokenText: searchResult.summary_for_voice || `Found verified information for "${query}".`,
                content: searchResult.detailed_answer || searchResult.context,
                sources: searchResult.sources && searchResult.sources.length > 0 ? searchResult.sources : undefined,
                sources_count: searchResult.sources_used_count || (searchResult.sources ? searchResult.sources.length : 0),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);

            // 3. Send tool result back to OpenAI Realtime session so model speaks concise summary
            const toolOutputEvent = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({
                  college_name: searchResult.college_name,
                  sources_count: searchResult.sources_used_count,
                  sources: searchResult.sources.map(s => ({ title: s.title, url: s.url })),
                  context: searchResult.context,
                  note: "Full breakdown tables and detailed course/fee lists are already displayed on the user's screen. Speak only a 1-3 sentence polite spoken summary."
                })
              }
            };

            isToolExecutingRef.current = false;

            if (dc.readyState === 'open') {
              dc.send(JSON.stringify(toolOutputEvent));
              dc.send(JSON.stringify({ type: 'response.create' }));
            }
          } catch (toolErr) {
            console.error('Failed to execute college web search tool:', toolErr);
            isToolExecutingRef.current = false;
            if (dc.readyState === 'open' && callId) {
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({
                    error: 'Could not fetch web page data.',
                    message: 'Please state information was not found in available official sources.'
                  })
                }
              }));
              dc.send(JSON.stringify({ type: 'response.create' }));
            }
          }
        } else if (event.type === 'response.output_item.done' && event.item?.role === 'assistant') {
          // Non-tool direct message (e.g. greeting "Hello")
          const textContent = event.item.content?.map((c: any) => c.transcript || c.text).filter(Boolean).join(' ') || '';
          if (textContent && textContent.trim()) {
            setMessages(prev => {
              if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
                return prev.map((m, idx) => idx === prev.length - 1 ? { ...m, spokenText: textContent.trim() } : m);
              }
              return [
                ...prev,
                {
                  id: `assistant_${Date.now()}`,
                  role: 'assistant',
                  spokenText: textContent.trim(),
                  content: textContent.trim(),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ];
            });
          }
        }
        break;

      // Streaming Spoken Answer Text (Voice Output)
      case 'response.audio_transcript.delta':
      case 'response.text.delta':
        const delta = event.delta || event.text || '';
        isBotRespondingRef.current = true;
        setIsBotResponding(true);
        if (outboundTrackRef.current) {
          outboundTrackRef.current.enabled = false;
        }
        setIsGateOpen(false);
        setVoiceState('speaking');
        setStatusDetail(
          language === 'hi' ? '🔊 उत्तर दिया जा रहा है... (माइक बंद है)' : '🔊 Speaking answer... (Mic locked)'
        );
        setCurrentAssistantText(prev => prev + delta);
        break;

      case 'response.audio_transcript.done':
      case 'response.text.done':
        const spokenDone = (event.transcript || event.text || '').trim();
        if (spokenDone) {
          setMessages(prev => {
            if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
              // Update last assistant message's spokenText
              return prev.map((m, idx) => idx === prev.length - 1 ? { ...m, spokenText: spokenDone } : m);
            }
            // Add as new assistant message if none exists
            return [
              ...prev,
              {
                id: `assistant_${Date.now()}`,
                role: 'assistant',
                spokenText: spokenDone,
                content: pendingToolResult?.detailed_answer || spokenDone,
                sources: pendingToolResult?.sources,
                sources_count: pendingToolResult?.sources_used_count,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ];
          });
          setCurrentAssistantText('');
          setPendingToolResult(null);
        }
        break;

      case 'response.audio.done':
        // Audio stream payload has reached browser; now letting speaker finish
        break;

      // Response Completed: Check if it was intermediate tool-call or final spoken answer
      case 'response.done':
        const outputItems = event.response?.output || [];
        const hasFunctionCall = outputItems.some((item: any) => item.type === 'function_call');

        if (hasFunctionCall || isToolExecutingRef.current) {
          // Intermediate response that generated a function call.
          // College search is underway; DO NOT UNLOCK MIC YET!
          break;
        }

        // Commit any leftover currentAssistantText that wasn't committed
        if (currentAssistantText && currentAssistantText.trim()) {
          const txt = currentAssistantText.trim();
          setMessages(prev => {
            if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
              return prev.map((m, idx) => idx === prev.length - 1 ? { ...m, spokenText: txt } : m);
            }
            return [
              ...prev,
              {
                id: `assistant_${Date.now()}`,
                role: 'assistant',
                spokenText: txt,
                content: pendingToolResult?.detailed_answer || txt,
                sources: pendingToolResult?.sources,
                sources_count: pendingToolResult?.sources_used_count,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ];
          });
          setCurrentAssistantText('');
        }

        // Voice output complete: Wait 500ms grace period so audio playback buffer completely finishes from speakers
        if (botFinishTimeoutRef.current) {
          clearTimeout(botFinishTimeoutRef.current);
        }
        botFinishTimeoutRef.current = setTimeout(() => {
          if (voiceStateRef.current === 'disconnected' || voiceStateRef.current === 'error') return;

          // VOICE STOPPED -> NOW TURN MIC ON FOR SECOND QUESTION!
          isBotRespondingRef.current = false;
          setIsBotResponding(false);
          setVoiceState('listening');

          if (voiceMode === 'push_to_talk') {
            if (outboundTrackRef.current) {
              outboundTrackRef.current.enabled = false;
            }
            setIsPushTalking(false);
            isPushTalkingRef.current = false;
            setStatusDetail(
              language === 'hi'
                ? `🎙️ उत्तर पूरा हुआ! अगला सवाल पूछने के लिए बटन दबाएं (या Space दबाएं)...`
                : `🎙️ Answer complete! Hold button or press Space to ask next question...`
            );
          } else {
            if (voiceMode === 'hands_free') {
              if (outboundTrackRef.current) {
                outboundTrackRef.current.enabled = !isMuted;
              }
            }
            // in crowd_filter mode, startNoiseGate loop now permits gate to open when user speaks
            setStatusDetail(
              language === 'hi'
                ? `🎙️ उत्तर पूरा हुआ! ${activeProject?.college_name || 'कॉलेज'} के बारे में अगला सवाल पूछें (माइक ऑन है)।`
                : `🎙️ Answer complete! Ask your next question about ${activeProject?.college_name || 'the college'} (Mic is active).`
            );
          }
        }, 500);
        break;

      case 'error':
        if (botFinishTimeoutRef.current) {
          clearTimeout(botFinishTimeoutRef.current);
          botFinishTimeoutRef.current = null;
        }
        isBotRespondingRef.current = false;
        setIsBotResponding(false);
        isToolExecutingRef.current = false;
        if (outboundTrackRef.current && voiceMode === 'hands_free' && !isMuted) {
          outboundTrackRef.current.enabled = true;
        }
        console.error('Realtime Server Error Event:', event);
        if (event.error?.message) {
          setStatusDetail(`Error: ${event.error.message}`);
        }
        break;

      default:
        break;
    }
  };

  const askQuery = async (queryText: string) => {
    // Add user message
    const userMsgId = `user_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: queryText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    // If active WebRTC data channel is open, send to OpenAI Realtime
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      isBotRespondingRef.current = true;
      setIsBotResponding(true);
      if (outboundTrackRef.current) {
        outboundTrackRef.current.enabled = false;
      }
      setIsGateOpen(false);
      setVoiceState('searching');
      setStatusDetail(
        language === 'hi'
          ? `🔎 "${queryText}" खोजा जा रहा है... (माइक बंद है)`
          : `🔎 Searching for "${queryText}"... (Mic locked)`
      );
      const event = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: queryText }]
        }
      };
      dataChannelRef.current.send(JSON.stringify(event));
      dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
    } else {
      // Execute backend search tool directly to display rich response & sources immediately
      setVoiceState('searching');
      setStatusDetail(
        language === 'hi'
          ? `🔎 ${activeProject?.college_name || 'कॉलेज'} की वेबसाइट पर खोजा जा रहा है...`
          : `🔎 Searching ${activeProject?.college_name || 'college'} website for "${queryText}"...`
      );
      try {
        const searchResult = await api.executeVoiceSearchTool(
          activeProjectId,
          queryText,
          3,
          language
        );
        setMessages(prev => [
          ...prev,
          {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            spokenText: searchResult.summary_for_voice || `Found verified information for "${queryText}".`,
            content: searchResult.detailed_answer || searchResult.context,
            sources: searchResult.sources,
            sources_count: searchResult.sources_used_count,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setVoiceState('disconnected');
        setStatusDetail('Verified details loaded from official college website.');
      } catch (err: any) {
        console.error('Direct search error:', err);
        setVoiceState('disconnected');
        setStatusDetail('Could not fetch results. Please retry.');
      }
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (!isBotRespondingRef.current && outboundTrackRef.current) {
      outboundTrackRef.current.enabled = !nextMuted;
    }
  };

  const suggestedQuestions = language === 'hi' ? [
    'B.Tech CSE ki total fees structure kya hai?',
    'Engineering admission process aur eligibility criteria kya hai?',
    'Campus placements aur highest package kitna gaya hai?',
    'Hostel aur mess ki kya facilities aur room charges hain?',
    'Kaun-kaun si engineering branches aur courses available hain?'
  ] : [
    'What B.Tech courses are available?',
    'What is the detailed fee structure for engineering?',
    'Tell me about campus placements & highest package.',
    'What are the hostel and dining facilities?',
    'What is the admission procedure & eligibility criteria?'
  ];

  if (projectsLoading) {
    return (
      <div className="max-w-[1550px] w-full mx-auto py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
        </div>
        <div className="text-sm font-bold text-slate-800">Loading College Voice Search...</div>
        <p className="text-xs text-slate-500">Preparing Indian tone realtime voice session...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1550px] w-full mx-auto py-3 sm:py-5 px-2 sm:px-4 lg:px-6 space-y-4 sm:space-y-5">
      {/* SINGLE UNIFIED WINDOW CONTAINER */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden flex flex-col divide-y divide-slate-100">
        
        {/* WINDOW HEADER: Controls, Language, College & BETA Badge */}
        <div className="bg-gradient-to-r from-teal-900 via-emerald-950 to-slate-900 text-white p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-teal-500/30 text-teal-200 border border-teal-400/40 text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-300" /> Voice Web Search
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] sm:text-[11px] font-black tracking-wider uppercase flex items-center gap-1">
                <Sparkle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 fill-amber-300" /> BETA
              </span>
              <span className="px-2 py-0.5 sm:px-2.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5">
                <Radio className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 animate-pulse" />
                Indian Accent &bull; WebRTC
              </span>
            </div>

            <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              {activeProject ? activeProject.college_name : 'College Voice Search'}
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/80 max-w-2xl leading-relaxed">
              Voice answers concisely in natural Indian English/Hindi &bull; Full tables, fee breakdowns &amp; verified sources show on screen.
            </p>
          </div>

          {/* Controls: College Selector, Language Toggle, Voice Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto shrink-0">
            {/* College Project Selector */}
            <div className="bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-teal-500/30 flex items-center gap-2 min-w-0">
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
              <select
                value={activeProjectId}
                onChange={(e) => {
                  const pId = e.target.value;
                  if (voiceState !== 'disconnected') handleEndSession();
                  setActiveProjectId(pId);
                  router.push(`/college-voice-search?project_id=${pId}`);
                }}
                className="bg-transparent text-xs font-bold text-teal-100 focus:outline-none cursor-pointer truncate w-full"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.college_name} ({p.base_domain})
                  </option>
                ))}
              </select>
            </div>

            {/* Language Toggle: English (India) / Hindi */}
            <div className="bg-slate-900/90 p-1 rounded-xl border border-teal-500/30 flex items-center justify-between sm:justify-start gap-1">
              <button
                type="button"
                onClick={() => {
                  if (voiceState !== 'disconnected') handleEndSession();
                  setLanguage('en-IN');
                }}
                className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  language === 'en-IN'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>🇮🇳 English</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (voiceState !== 'disconnected') handleEndSession();
                  setLanguage('hi');
                }}
                className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  language === 'hi'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>🇮🇳 Hinglish / हिंदी</span>
              </button>
            </div>

            {/* Voice Tone Selector */}
            <div className="bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-teal-500/30 flex items-center gap-1.5 text-xs font-bold text-teal-200">
              <Volume2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={voiceState !== 'disconnected' && voiceState !== 'error'}
                className="bg-transparent text-xs font-bold text-teal-100 focus:outline-none cursor-pointer disabled:opacity-50 truncate w-full"
              >
                <option value="verse" className="bg-slate-900 text-white">Indian Tone (Verse)</option>
                <option value="coral" className="bg-slate-900 text-white">Warm Tone (Coral)</option>
                <option value="alloy" className="bg-slate-900 text-white">Balanced (Alloy)</option>
                <option value="sage" className="bg-slate-900 text-white">Direct (Sage)</option>
                <option value="shimmer" className="bg-slate-900 text-white">Clear (Shimmer)</option>
              </select>
            </div>

            {/* Switch to Text Search Link */}
            <Link
              href={`/college-web-search?project_id=${activeProjectId || ''}`}
              className="bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-teal-500/30 text-xs font-bold text-teal-200 flex items-center justify-center gap-1.5 transition-all shadow-sm"
              title="Switch to Text Live Web Search"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>Text Chat</span>
            </Link>
          </div>
        </div>

        {/* 3-MODE VOICE SELECTOR BAR (Crowd Shield vs Push-to-Talk vs Quiet Room) */}
        <div className="bg-slate-900 px-4 py-2.5 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold text-teal-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Voice Mode:
            </span>
            <div className="inline-flex flex-wrap rounded-xl bg-slate-800/90 p-1 border border-teal-500/20 shadow-inner gap-1">
              {/* 1. Crowd Shield (Auto Gate) */}
              <button
                type="button"
                onClick={() => {
                  if (voiceState !== 'disconnected') handleEndSession();
                  setVoiceMode('crowd_filter');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  voiceMode === 'crowd_filter'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>🛡️ Crowd Shield (Auto)</span>
              </button>

              {/* 2. Push-to-Talk (Hold) */}
              <button
                type="button"
                onClick={() => {
                  if (voiceState !== 'disconnected') handleEndSession();
                  setVoiceMode('push_to_talk');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  voiceMode === 'push_to_talk'
                    ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>🎙️ Push-to-Talk (Hold)</span>
              </button>

              {/* 3. Quiet Room (Normal) */}
              <button
                type="button"
                onClick={() => {
                  if (voiceState !== 'disconnected') handleEndSession();
                  setVoiceMode('hands_free');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  voiceMode === 'hands_free'
                    ? 'bg-teal-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>⚡ Quiet Room</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            {voiceMode === 'crowd_filter' ? (
              <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Proximity Gate + Calibrated VAD (0.85): Background crowd murmurs are silenced.
              </span>
            ) : voiceMode === 'push_to_talk' ? (
              <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                100% Zero Ambient Noise &bull; Hold button or [Spacebar] to speak
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-teal-300">
                <Radio className="w-3.5 h-3.5 text-teal-400" />
                Standard Continuous Voice &bull; Best for silent rooms &amp; offices
              </span>
            )}
          </div>
        </div>

        {/* 2-COLUMN SPLIT GRID ON DESKTOP: LEFT VOICE CONTROLS (5 cols), RIGHT LIVE FEED (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 flex-1">
          {/* LEFT COLUMN: Voice Control Console */}
          <div className="lg:col-span-5 p-4 sm:p-6 lg:p-7 bg-gradient-to-b from-slate-50/80 to-white flex flex-col justify-between items-center text-center relative overflow-hidden space-y-4 sm:space-y-5">
          {/* Ambient Wave FX when active */}
          {(voiceState === 'listening' || voiceState === 'speaking' || isPushTalking) && (
            <div className={`absolute inset-0 pointer-events-none animate-pulse ${
              isPushTalking ? 'bg-red-50/60' : isGateOpen ? 'bg-emerald-50/50' : 'bg-teal-50/40'
            }`} />
          )}

          {/* Status Badge & Proximity Gate Indicator */}
          <div className="flex flex-wrap items-center justify-center gap-2 z-10">
            <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all ${
              isPushTalking
                ? 'bg-red-100 text-red-800 border border-red-300 ring-4 ring-red-500/30 animate-pulse'
                : isBotResponding
                ? 'bg-amber-100 text-amber-900 border border-amber-300 ring-2 ring-amber-500/30 animate-pulse'
                : voiceState === 'speaking'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-500/20 animate-pulse'
                : voiceState === 'listening'
                ? isGateOpen
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-500/20 animate-pulse'
                  : 'bg-teal-100 text-teal-800 border border-teal-300 ring-2 ring-teal-500/20'
                : voiceState === 'searching'
                ? 'bg-amber-100 text-amber-800 border border-amber-300 ring-2 ring-amber-500/20'
                : voiceState === 'connecting'
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : voiceState === 'error'
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-slate-100 text-slate-700 border border-slate-300'
            }`}>
              {isPushTalking && <Mic className="w-4 h-4 animate-bounce text-red-600" />}
              {!isPushTalking && isBotResponding && <Lock className="w-4 h-4 text-amber-700 animate-pulse" />}
              {!isPushTalking && !isBotResponding && voiceState === 'speaking' && <Volume2 className="w-4 h-4 animate-bounce text-emerald-600" />}
              {!isPushTalking && !isBotResponding && voiceState === 'listening' && (
                isGateOpen ? <Mic className="w-4 h-4 text-emerald-600 animate-pulse" /> : <ShieldCheck className="w-4 h-4 text-teal-600" />
              )}
              {!isPushTalking && !isBotResponding && voiceState === 'searching' && <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />}
              {!isPushTalking && voiceState === 'connecting' && <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />}
              {!isPushTalking && voiceState === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
              {!isPushTalking && voiceState === 'disconnected' && <Radio className="w-4 h-4 text-slate-400" />}
              
              <span className="uppercase tracking-wider">
                {isPushTalking && (language === 'hi' ? 'बोल रहे हैं... छोड़ते ही जवाब आएगा' : 'Recording Voice... Release to Send')}
                {!isPushTalking && isBotResponding && (
                  voiceState === 'speaking'
                    ? (language === 'hi' ? '🔒 उत्तर बोल रहे हैं (माइक बंद है)' : '🔒 Speaking Answer (Mic Muted)')
                    : (language === 'hi' ? '🔒 सवाल प्रोसेस हो रहा है (माइक बंद है)' : '🔒 Processing Query (Mic Muted)')
                )}
                {!isPushTalking && !isBotResponding && voiceState === 'speaking' && (language === 'hi' ? 'उत्तर दिया जा रहा है' : 'Speaking Spoken Answer')}
                {!isPushTalking && !isBotResponding && voiceState === 'listening' && (
                  voiceMode === 'push_to_talk'
                    ? (language === 'hi' ? 'पुश-टू-टॉक: बोलने के लिए होल्ड करें' : 'Push-to-Talk: Hold to Speak')
                    : voiceMode === 'crowd_filter'
                    ? (isGateOpen
                        ? (language === 'hi' ? 'माइक खुला है: बोलिए...' : 'Voice Detected: Speak Now...')
                        : (language === 'hi' ? 'माइक ऑन है: सवाल बोलें' : 'Mic Active: Speak Question'))
                    : (language === 'hi' ? 'सुन रहे हैं... सवाल बोलें' : 'Listening... Speak Question')
                )}
                {!isPushTalking && !isBotResponding && voiceState === 'searching' && (language === 'hi' ? 'वेबसाइट पर खोज जारी है' : 'Searching College Website')}
                {!isPushTalking && voiceState === 'connecting' && (language === 'hi' ? 'रियलटाइम कनेक्ट हो रहा है...' : 'Connecting Realtime')}
                {!isPushTalking && voiceState === 'error' && 'Session Error'}
                {!isPushTalking && voiceState === 'disconnected' && (language === 'hi' ? 'तैयार / Idle' : 'Ready / Idle')}
              </span>
            </span>

            {voiceMode === 'push_to_talk' && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <span>Hold to speak &bull; [SPACE]</span>
              </span>
            )}

            {voiceMode === 'crowd_filter' && voiceState !== 'disconnected' && voiceState !== 'error' && (
              <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                isBotResponding
                  ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-400/20'
                  : isGateOpen
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}>
                {isBotResponding ? (
                  <>
                    <Lock className="w-2.5 h-2.5 text-amber-600" />
                    <span>Mic Locked</span>
                  </>
                ) : isGateOpen ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Transmitting</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Crowd Muted</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* REALTIME CROWD SHIELD PROXIMITY METER (Visible when connected in crowd_filter mode) */}
          {voiceMode === 'crowd_filter' && (voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'searching') && (
            <div className="w-full max-w-sm bg-slate-900/90 text-white rounded-2xl p-2.5 sm:p-3 border border-teal-500/30 shadow-lg flex flex-col gap-2 z-10">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-teal-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mic Proximity: <strong className="text-white text-xs">{audioLevel}%</strong></span>
                </span>
                <span className={isBotResponding ? 'text-amber-400 font-bold flex items-center gap-1' : isGateOpen ? 'text-emerald-400 font-black flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                  <span className={`w-2 h-2 rounded-full ${isBotResponding ? 'bg-amber-400' : isGateOpen ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  {isBotResponding ? '🔒 Mic Locked' : isGateOpen ? '🟢 Voice Active' : '🛡️ Crowd Silenced'}
                </span>
              </div>

              {/* Progress bar with gate threshold marker */}
              <div className="relative w-full h-3.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
                <div
                  className={`h-full transition-all duration-75 rounded-full ${
                    isGateOpen
                      ? 'bg-gradient-to-r from-teal-400 to-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-slate-600'
                  }`}
                  style={{ width: `${Math.max(2, audioLevel)}%` }}
                />
                {/* Gate Threshold Marker placed exactly at gateThresholdPct */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-md ring-1 ring-amber-300 transition-all duration-150"
                  style={{ left: `${Math.min(95, Math.max(2, gateThresholdPct))}%` }}
                  title={`Cutoff Threshold: ${gateThresholdPct}% (Sound below this is filtered out)`}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-400 px-0.5">
                <span>🔇 Room Murmur</span>
                <span className="text-amber-400 font-bold bg-slate-800/80 px-1.5 py-0.5 rounded border border-amber-400/30">
                  &larr; Cutoff: {gateThresholdPct}% &rarr;
                </span>
                <span className="text-emerald-300">🗣️ User Voice</span>
              </div>

              {/* Sensitivity Presets & Interactive Slider */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800 text-[10px]">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCalibrateRoom}
                      disabled={isCalibrating}
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all flex items-center gap-1 border ${
                        isCalibrating
                          ? 'bg-amber-400 text-slate-950 border-amber-300 animate-pulse'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-sm'
                      }`}
                      title="1-Click: Measures your room noise for 1s and sets cutoff safely above it"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>{isCalibrating ? 'Measuring...' : 'Auto-Calibrate'}</span>
                    </button>
                  </div>

                  <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setGateThresholdPct(4)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                        gateThresholdPct === 4
                          ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Quiet room (opens at 4%)"
                    >
                      Quiet (4%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGateThresholdPct(7)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                        gateThresholdPct === 7
                          ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Normal room with fan (opens at 7%)"
                    >
                      Normal (7%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGateThresholdPct(12)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                        gateThresholdPct === 12
                          ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Noisy room / background murmur (opens at 12%)"
                    >
                      Noisy (12%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGateThresholdPct(18)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                        gateThresholdPct === 18
                          ? 'bg-red-500 text-white font-black shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Loud crowd / canteen shield (opens at 18%)"
                    >
                      Crowd (18%)
                    </button>
                  </div>
                </div>

                {/* Fine-tuning range slider */}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[9px] text-slate-400 shrink-0">Fine Adjust:</span>
                  <input
                    type="range"
                    min="2"
                    max="25"
                    step="1"
                    value={gateThresholdPct}
                    onChange={(e) => setGateThresholdPct(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
                    title={`Drag to set threshold (${gateThresholdPct}%)`}
                  />
                  <span className="text-[10px] font-black text-amber-300 shrink-0 w-6 text-right">
                    {gateThresholdPct}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Central Interactive Mic / Push-to-Talk / End Call Button */}
          <div className="relative z-10 py-1">
            {/* Ambient pulse rings */}
            {(voiceState === 'listening' || voiceState === 'speaking' || isPushTalking || isBotResponding) && (
              <>
                <div className={`absolute inset-0 rounded-full animate-ping ${
                  isPushTalking ? 'bg-red-400/30' : isBotResponding ? 'bg-amber-400/30' : isGateOpen ? 'bg-emerald-400/30' : 'bg-teal-400/20'
                }`} />
                <div className={`absolute -inset-3 rounded-full animate-pulse ${
                  isPushTalking ? 'bg-red-500/20' : isBotResponding ? 'bg-amber-500/20' : isGateOpen ? 'bg-emerald-500/20' : 'bg-teal-500/10'
                }`} />
              </>
            )}

            {/* If DISCONNECTED: Start Button */}
            {(voiceState === 'disconnected' || voiceState === 'error') && (
              <button
                type="button"
                onClick={handleStartVoice}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all shadow-xl select-none group bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white ring-4 ring-teal-200 shadow-teal-600/30 hover:scale-105 active:scale-95"
              >
                <Mic className="w-9 h-9 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-extrabold mt-1 uppercase tracking-wider">
                  {voiceMode === 'push_to_talk' ? 'Start PTT' : voiceMode === 'crowd_filter' ? 'Start Shield' : 'Start Voice'}
                </span>
              </button>
            )}

            {/* If CONNECTING: Spinner */}
            {voiceState === 'connecting' && (
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center bg-teal-700 text-white ring-4 ring-teal-300/40 shadow-xl">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-[9px] font-extrabold mt-1 uppercase tracking-wider">Connecting</span>
              </div>
            )}

            {/* If CONNECTED in PUSH-TO-TALK MODE: Hold-to-speak Button */}
            {voiceMode === 'push_to_talk' && (voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'searching') && (
              <button
                type="button"
                disabled={isBotResponding}
                onMouseDown={handlePushTalkStart}
                onMouseUp={handlePushTalkEnd}
                onMouseLeave={handlePushTalkEnd}
                onTouchStart={handlePushTalkStart}
                onTouchEnd={handlePushTalkEnd}
                onTouchCancel={handlePushTalkEnd}
                className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl select-none group ${
                  isBotResponding
                    ? 'bg-slate-800 text-slate-300 ring-4 ring-amber-400/40 opacity-90 cursor-not-allowed'
                    : isPushTalking
                    ? 'bg-gradient-to-tr from-red-600 to-rose-600 text-white ring-8 ring-red-400/50 scale-105 shadow-red-600/40 cursor-pointer'
                    : 'bg-gradient-to-tr from-amber-500 via-amber-400 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 ring-4 ring-amber-300 shadow-amber-500/30 hover:scale-105 active:scale-95 cursor-pointer'
                }`}
              >
                {isBotResponding ? (
                  <>
                    <Lock className="w-9 h-9 text-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black mt-1 uppercase tracking-wider text-amber-300">
                      {voiceState === 'speaking' ? 'Speaking...' : 'Searching...'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 -mt-0.5">Mic Locked</span>
                  </>
                ) : isPushTalking ? (
                  <>
                    <Volume2 className="w-10 h-10 animate-pulse text-white" />
                    <span className="text-[10px] font-black mt-1 uppercase tracking-wider text-white">Release to Send</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-10 h-10 text-slate-950 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black mt-1 uppercase tracking-wider">Hold to Speak</span>
                    <span className="text-[8px] font-bold text-slate-800/80 -mt-0.5">[Spacebar]</span>
                  </>
                )}
              </button>
            )}

            {/* If CONNECTED in CROWD SHIELD or HANDS-FREE MODE: Click to End Call */}
            {voiceMode !== 'push_to_talk' && (voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'searching') && (
              <button
                type="button"
                onClick={handleEndSession}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all shadow-xl select-none group bg-gradient-to-tr from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white ring-4 ring-rose-300/50 shadow-rose-500/30 active:scale-95"
              >
                <PhoneOff className="w-8 h-8 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-extrabold mt-1 uppercase tracking-wider">End Voice</span>
              </button>
            )}
          </div>

          {/* Status Subtitle */}
          <div className="space-y-1 max-w-xl z-10">
            <p className="text-sm font-semibold text-slate-800 transition-all">
              {statusDetail}
            </p>
            <p className="text-xs text-slate-500">
              {voiceState === 'disconnected'
                ? (voiceMode === 'push_to_talk'
                    ? (language === 'hi' ? 'पुश-टू-टॉक शुरू करें। बातचीत के दौरान बटन दबाकर रखेंगे तभी आपकी आवाज़ जाएगी।' : 'Start Push-to-Talk. Microphone only transmits while you hold the button or spacebar.')
                    : voiceMode === 'crowd_filter'
                    ? (language === 'hi' ? '🛡️ क्राउड शील्ड एक्टिव है। आसपास के लोगों और शोर की आवाज़ अपने आप म्यूट हो जाएगी।' : '🛡️ Crowd Noise Shield active. Ambient room chatter and distant crowd voices are automatically silenced.')
                    : (language === 'hi' ? 'हैंड्स-फ्री वॉयस शुरू करें। शांत कमरे के लिए उपयुक्त।' : 'Start Hands-Free Voice. Continuous auto-detection best for quiet rooms.'))
                : `${activeProject?.college_name} (${activeProject?.base_domain}) &bull; Indian Tone`}
            </p>
          </div>

          {/* Mute & Disconnect controls when active */}
          {(voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'searching') && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 z-10">
              {voiceMode !== 'push_to_talk' && (
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    isMuted
                      ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-600" /> : <Mic className="w-3.5 h-3.5 text-slate-600" />}
                  <span>{isMuted ? 'Unmute' : 'Mute Mic'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleEndSession}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Voice Session</span>
              </button>
            </div>
          )}

          {/* Error alert if any */}
          {errorMessage && (
            <div className="w-full max-w-lg p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 text-left flex items-start gap-3 z-10">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-bold">Voice Error:</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* HORIZONTAL SUGGESTED QUESTIONS CHIPS */}
          <div className="w-full max-w-3xl pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none text-left z-10 pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Try:
            </span>
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => askQuery(q)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:border-teal-300 text-slate-700 hover:text-teal-900 text-[11px] sm:text-xs whitespace-nowrap font-medium border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <Mic className="w-3 h-3 text-teal-600" />
                <span>"{q}"</span>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: INTEGRATED LIVE RESPONSE & CONVERSATION FEED */}
        <div className="lg:col-span-7 p-3.5 sm:p-6 bg-slate-50/50 flex flex-col space-y-4 sm:space-y-5 min-h-[500px] lg:h-[720px]">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <MessageSquare className="w-4 h-4 text-teal-700 shrink-0" />
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                Live Voice &amp; Detailed Output
              </h3>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[9px] sm:text-[10px] font-bold">
                Spoken + Tables
              </span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[11px] sm:text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages Area */}
          <div className="space-y-4 sm:space-y-5 flex-1 overflow-y-auto pr-0.5 sm:pr-1 min-h-0">
            {messages.length === 0 && !currentAssistantText && (
              <div className="text-center py-8 sm:py-12 text-slate-400 text-xs space-y-2 px-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-teal-600 shadow-sm">
                  <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                </div>
                <div className="font-bold text-slate-700 text-xs sm:text-sm">No spoken messages yet</div>
                <p className="max-w-md mx-auto text-[11px] sm:text-xs text-slate-500">
                  Click <strong>Start Voice</strong> above and speak. The AI will speak a concise summary aloud, and all full detail tables (tuition fees, courses, hostel rates, criteria) will automatically appear right here!
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5 w-full`}
              >
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {m.role === 'user' ? 'You (Spoken)' : `${activeProject?.college_name || 'College'} AI`}
                  </span>
                  <span className="text-[10px] text-slate-400">{m.timestamp}</span>
                </div>

                <div
                  className={`p-3.5 sm:p-5 rounded-2xl max-w-full sm:max-w-3xl text-xs sm:text-sm leading-relaxed overflow-hidden ${
                    m.role === 'user'
                      ? 'bg-gradient-to-tr from-teal-800 to-emerald-800 text-white rounded-br-sm shadow-md'
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {/* If assistant turn, show spoken headline + full rich markdown details */}
                  {m.role === 'assistant' ? (
                    <div className="space-y-3">
                      {/* Only display separate Spoken Answer callout if spokenText is distinctly different from content */}
                      {m.spokenText && m.content && m.content.trim() !== m.spokenText.trim() && (m.sources?.length || m.content.length > m.spokenText.length + 30) ? (
                        <div className="p-2.5 sm:p-3 rounded-xl bg-teal-50/80 border border-teal-200 text-teal-950 font-medium text-xs flex items-start gap-2">
                          <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-bold text-teal-900 text-xs">Spoken Answer:</strong>
                            <p className="italic text-xs">"{m.spokenText}"</p>
                          </div>
                        </div>
                      ) : null}

                      {/* FULL DETAILED MARKDOWN CONTENT (Tables, Lists, Numbers) */}
                      <div className="pt-1 overflow-x-auto">
                        <MarkdownContent
                          content={m.content || m.spokenText || ''}
                          isUser={false}
                          className="text-slate-800"
                        />
                      </div>

                      {/* VERIFIED SOURCES TRANSPARENCY SECTION */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-100 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-teal-600" />
                              Sources used: <strong className="text-teal-800">{m.sources.length} official pages</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold">
                              Verified Official Site
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {m.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition-all flex items-start justify-between gap-2 group text-left"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-slate-800 group-hover:text-teal-800 truncate">
                                    {src.title}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                                    {src.url.replace(/^https?:\/\/(www\.)?/, '')}
                                  </div>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0 mt-0.5 transition-colors" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap font-medium">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming assistant turn while speaking */}
            {currentAssistantText && (
              <div className="flex flex-col items-start space-y-1.5 animate-in fade-in duration-150">
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-teal-600 animate-bounce" />
                  Speaking Aloud...
                </span>
                <div className="p-3.5 sm:p-4 rounded-2xl bg-teal-50 border border-teal-200 text-slate-800 text-xs sm:text-sm max-w-full sm:max-w-xl shadow-xs">
                  <p className="whitespace-pre-wrap font-medium">{currentAssistantText}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

        {/* BOTTOM HELPER BAR */}
        <div className="p-3 sm:p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-[11px] sm:text-xs text-slate-500">
          <div className="flex items-center gap-1.5 sm:gap-2 text-center sm:text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Domain-bound strictly to <strong>{activeProject?.base_domain}</strong>.</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/college-web-search?project_id=${activeProjectId}`}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
            >
              <span>Switch to Text Search</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function CollegeVoiceSearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-[1550px] w-full mx-auto py-20 flex justify-center text-sm font-bold text-slate-600">
        Loading College Voice Search...
      </div>
    }>
      <CollegeVoiceSearchContent />
    </Suspense>
  );
}
