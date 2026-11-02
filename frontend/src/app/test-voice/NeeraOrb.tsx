'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import './neera-orb.css';

export interface NeeraOrbProps {
  voiceState: 'off' | 'connecting' | 'live' | 'error';
  agentState: 'idle' | 'listening' | 'searching' | 'speaking';
  isMicMuted: boolean;
  isSpeakerMuted: boolean;
  isMicReceivingAudio: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  spectrumHeights?: number[];
  onOrbClick?: () => void;
  statusMessage?: string;
  className?: string;
}

export type OrbVisualState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'user-speaking'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'error';

interface Particle {
  a: number;
  r: number;
  s: number;
  phase: number;
  alpha: number;
  speed: number;
  hue: number;
}

interface SoundRipple {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

const BAR_COUNT = 44; // 44 radial frequency equalizer bars encircling the orb

export default function NeeraOrb({
  voiceState,
  agentState,
  isMicMuted,
  isSpeakerMuted,
  isMicReceivingAudio,
  localStream,
  remoteStream,
  spectrumHeights,
  onOrbClick,
  statusMessage,
  className = '',
}: NeeraOrbProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const leftEyeRef = useRef<HTMLDivElement | null>(null);
  const rightEyeRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isBlinking, setIsBlinking] = useState(false);

  // Compute active visual state
  const visualState: OrbVisualState = useMemo(() => {
    if (voiceState === 'off') return 'idle';
    if (voiceState === 'connecting') return 'connecting';
    if (voiceState === 'error') return 'error';

    // voiceState is 'live'
    if (isMicMuted) return 'muted';
    if (agentState === 'speaking') return 'speaking';
    if (agentState === 'searching') return 'thinking';
    if (isMicReceivingAudio) return 'user-speaking';
    return 'listening';
  }, [voiceState, isMicMuted, agentState, isMicReceivingAudio]);

  // Audio Analysers Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const assistantAnalyserRef = useRef<AnalyserNode | null>(null);
  const micDataRef = useRef<Uint8Array | null>(null);
  const micFreqDataRef = useRef<Uint8Array | null>(null);
  const assistantDataRef = useRef<Uint8Array | null>(null);
  const assistantFreqDataRef = useRef<Uint8Array | null>(null);

  // Real-time smoothed frequency spectrum buffer (44 bins)
  const smoothFreqsRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  const ripplesRef = useRef<SoundRipple[]>([]);
  const lastRippleTimeRef = useRef<number>(0);

  // Animation Refs
  const animFrameRef = useRef<number | null>(null);
  const targetPointerRef = useRef({ x: 0, y: 0 });
  const currentPointerRef = useRef({ x: 0, y: 0 });
  const voiceLevelRef = useRef(0);
  const smoothVoiceRef = useRef(0);
  const visualStateRef = useRef<OrbVisualState>(visualState);
  const spectrumHeightsRef = useRef<number[] | undefined>(spectrumHeights);

  useEffect(() => {
    visualStateRef.current = visualState;
  }, [visualState]);

  useEffect(() => {
    spectrumHeightsRef.current = spectrumHeights;
  }, [spectrumHeights]);

  // 1. Natural Eye Blinking Cycle
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    const scheduleBlink = () => {
      const delay = Math.random() * 3200 + 3200; // 3.2 - 6.4s
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 140);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // 2. Audio Analysers Setup for Mic and Assistant
  useEffect(() => {
    if (voiceState !== 'live' && voiceState !== 'connecting') {
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch (e) {}
        audioContextRef.current = null;
      }
      micAnalyserRef.current = null;
      assistantAnalyserRef.current = null;
      micDataRef.current = null;
      micFreqDataRef.current = null;
      assistantDataRef.current = null;
      assistantFreqDataRef.current = null;
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Local Mic Analyser (DO NOT CONNECT TO DESTINATION — NO FEEDBACK)
      if (localStream && localStream.getAudioTracks().length > 0) {
        try {
          const micSource = ctx.createMediaStreamSource(localStream);
          const micAnalyser = ctx.createAnalyser();
          micAnalyser.fftSize = 128; // 64 frequency bins for fast voice FFT
          micAnalyser.smoothingTimeConstant = 0.65; // High responsiveness to spoken syllables
          micSource.connect(micAnalyser);
          micAnalyserRef.current = micAnalyser;
          micDataRef.current = new Uint8Array(micAnalyser.fftSize);
          micFreqDataRef.current = new Uint8Array(micAnalyser.frequencyBinCount);
        } catch (micErr) {
          console.warn('NeeraOrb mic analyser note:', micErr);
        }
      }

      // Remote Assistant Analyser (DO NOT CONNECT TO DESTINATION — ALREADY PLAYED BY AUDIO TAG)
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        try {
          const assistantSource = ctx.createMediaStreamSource(remoteStream);
          const assistantAnalyser = ctx.createAnalyser();
          assistantAnalyser.fftSize = 128;
          assistantAnalyser.smoothingTimeConstant = 0.65;
          assistantSource.connect(assistantAnalyser);
          assistantAnalyserRef.current = assistantAnalyser;
          assistantDataRef.current = new Uint8Array(assistantAnalyser.fftSize);
          assistantFreqDataRef.current = new Uint8Array(assistantAnalyser.frequencyBinCount);
        } catch (asErr) {
          console.warn('NeeraOrb assistant analyser note:', asErr);
        }
      }
    } catch (e) {
      console.warn('NeeraOrb audio setup note:', e);
    }
  }, [voiceState, localStream, remoteStream]);

  // 3. Particles Initialization (60 optimized particles)
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 60 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.35 + Math.random() * 0.30,
      s: 0.8 + Math.random() * 2.0,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.2 + Math.random() * 0.6,
      speed: 0.00014 + Math.random() * 0.00022,
      hue: Math.random() > 0.5 ? 45 : 185, // Gold or Cyan
    }));
  }, []);

  // 4. Cursor / Pointer Tracking
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!orbRef.current) return;
      const rect = orbRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Bound to -1 .. 1
      const maxDistX = window.innerWidth * 0.38;
      const maxDistY = window.innerHeight * 0.38;
      targetPointerRef.current = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / maxDistX)),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / maxDistY)),
      };
    };

    const handlePointerLeave = () => {
      targetPointerRef.current = { x: 0, y: 0 };
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  // 5. Canvas Resize & DPR Optimization
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!canvas || !stage) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = stage.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 6. Main requestAnimationFrame Render Loop with Real-Time Frequency Sync
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Helper to read both time-domain level and frequency bands
    const updateAudioData = (t: number) => {
      const state = visualStateRef.current;
      const smoothFreqs = smoothFreqsRef.current;
      let rawVolume = 0;

      // --- A. Assistant Speaking State (Remote Track Audio) ---
      if (state === 'speaking' && assistantAnalyserRef.current) {
        if (assistantDataRef.current) {
          assistantAnalyserRef.current.getByteTimeDomainData(assistantDataRef.current as any);
          let sum = 0;
          for (let i = 0; i < assistantDataRef.current.length; i++) {
            const v = (assistantDataRef.current[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / assistantDataRef.current.length);
          rawVolume = Math.min(1, Math.max(0, (rms - 0.01) * 6.5));
        }

        if (assistantFreqDataRef.current) {
          assistantAnalyserRef.current.getByteFrequencyData(assistantFreqDataRef.current as any);
          const binCount = assistantFreqDataRef.current.length;
          const step = binCount / (BAR_COUNT / 2);

          for (let i = 0; i < BAR_COUNT; i++) {
            // Mirrored layout: bass at bottom, highs at top
            const halfIdx = i < BAR_COUNT / 2 ? i : BAR_COUNT - 1 - i;
            const binIdx = Math.min(binCount - 1, Math.floor(halfIdx * step));
            const rawVal = (assistantFreqDataRef.current[binIdx] || 0) / 255;
            const targetVal = Math.min(1, rawVal * 1.35);

            // Fast attack, smooth decay
            const lerpSpeed = targetVal > smoothFreqs[i] ? 0.45 : 0.15;
            smoothFreqs[i] += (targetVal - smoothFreqs[i]) * lerpSpeed;
          }
        }
        return rawVolume;
      }

      // --- B. User Speaking or Listening State (Microphone Track Audio) ---
      if (state === 'user-speaking' || state === 'listening') {
        let hasDirectMicData = false;

        if (micAnalyserRef.current && micDataRef.current && micFreqDataRef.current) {
          micAnalyserRef.current.getByteTimeDomainData(micDataRef.current as any);
          let sum = 0;
          for (let i = 0; i < micDataRef.current.length; i++) {
            const v = (micDataRef.current[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / micDataRef.current.length);
          rawVolume = Math.min(1, Math.max(0, (rms - 0.012) * 7.2));

          micAnalyserRef.current.getByteFrequencyData(micFreqDataRef.current as any);
          const binCount = micFreqDataRef.current.length;
          const step = binCount / (BAR_COUNT / 2);

          for (let i = 0; i < BAR_COUNT; i++) {
            const halfIdx = i < BAR_COUNT / 2 ? i : BAR_COUNT - 1 - i;
            const binIdx = Math.min(binCount - 1, Math.floor(halfIdx * step));
            const rawVal = (micFreqDataRef.current[binIdx] || 0) / 255;

            // Boost voice speech frequencies (phonemes / vowels)
            let targetVal = Math.min(1, rawVal * 1.45);

            // If user is not speaking right now, provide a gentle harmonic ambient wave
            if (rawVal < 0.08) {
              const ambientWave = 0.06 + 0.04 * Math.sin(t * 0.003 + (i / BAR_COUNT) * Math.PI * 4);
              targetVal = ambientWave;
            }

            const lerpSpeed = targetVal > smoothFreqs[i] ? 0.55 : 0.18;
            smoothFreqs[i] += (targetVal - smoothFreqs[i]) * lerpSpeed;
          }
          hasDirectMicData = true;
        }

        // Fallback or blend with spectrumHeights from page if direct analyser is initializing
        const extBars = spectrumHeightsRef.current;
        if (!hasDirectMicData && extBars && extBars.length > 0) {
          const maxH = Math.max(...extBars);
          rawVolume = Math.min(1, Math.max(0, (maxH - 8) / 38));

          for (let i = 0; i < BAR_COUNT; i++) {
            const extIdx = Math.floor((i / BAR_COUNT) * extBars.length);
            const val = extBars[extIdx] || 8;
            const targetVal = Math.max(0.06, (val - 8) / 44);
            const lerpSpeed = targetVal > smoothFreqs[i] ? 0.45 : 0.15;
            smoothFreqs[i] += (targetVal - smoothFreqs[i]) * lerpSpeed;
          }
        } else if (!hasDirectMicData) {
          // Subtle breathing wave in listening state
          for (let i = 0; i < BAR_COUNT; i++) {
            const wave = 0.07 + 0.04 * Math.sin(t * 0.0025 + (i / BAR_COUNT) * Math.PI * 4);
            smoothFreqs[i] += (wave - smoothFreqs[i]) * 0.1;
          }
        }

        return rawVolume;
      }

      // --- C. Thinking / Connecting / Idle States ---
      if (state === 'thinking' || state === 'connecting') {
        const pulse = state === 'thinking' ? 0.18 : 0.12;
        for (let i = 0; i < BAR_COUNT; i++) {
          const radar = Math.sin(t * 0.006 - (i / BAR_COUNT) * Math.PI * 2);
          const targetVal = Math.max(0.04, radar * pulse);
          smoothFreqs[i] += (targetVal - smoothFreqs[i]) * 0.15;
        }
        return 0.15;
      }

      // Idle / Off / Muted
      for (let i = 0; i < BAR_COUNT; i++) {
        const idleWave = 0.03 + 0.02 * Math.sin(t * 0.0015 + (i / BAR_COUNT) * Math.PI * 2);
        smoothFreqs[i] += (idleWave - smoothFreqs[i]) * 0.08;
      }

      return 0;
    };

    // Render Canvas Visuals (Radial Equalizer Bars, Sound Ripples, Wave Ribbon, Particles)
    const renderCanvas = (t: number, smooth: number, state: OrbVisualState) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Measure exact center and radius of the 3D Orb element
      let cx = w / 2;
      let cy = h / 2;
      let orbRadius = Math.min(w, h) * 0.34;

      if (orbRef.current && stageRef.current) {
        const orbRect = orbRef.current.getBoundingClientRect();
        const stageRect = stageRef.current.getBoundingClientRect();
        cx = orbRect.left - stageRect.left + orbRect.width / 2;
        cy = orbRect.top - stageRect.top + orbRect.height / 2;
        orbRadius = orbRect.width / 2;
      }

      const isThinking = state === 'thinking';
      const isSpeaking = state === 'speaking';
      const isUserSpeaking = state === 'user-speaking';
      const isListening = state === 'listening';
      const smoothFreqs = smoothFreqsRef.current;

      // -------------------------------------------------------------
      // 1. Acoustic Soundwave Ripples (Spawned when User Speaks)
      // -------------------------------------------------------------
      if ((isUserSpeaking || isSpeaking) && smooth > 0.14) {
        const now = performance.now();
        if (now - lastRippleTimeRef.current > 180) {
          lastRippleTimeRef.current = now;
          ripplesRef.current.push({
            radius: orbRadius + 8,
            maxRadius: orbRadius + 68 + smooth * 25,
            alpha: 0.75,
            speed: 1.6 + smooth * 2.2,
          });
        }
      }

      // Update and draw existing ripples
      for (let rIdx = ripplesRef.current.length - 1; rIdx >= 0; rIdx--) {
        const rip = ripplesRef.current[rIdx];
        rip.radius += rip.speed;
        rip.alpha *= 0.94; // Fade out

        if (rip.alpha < 0.03 || rip.radius > rip.maxRadius) {
          ripplesRef.current.splice(rIdx, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rip.radius, 0, Math.PI * 2);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = isUserSpeaking
          ? `rgba(16, 185, 129, ${rip.alpha})` // Emerald Green for Mic
          : isSpeaking
          ? `rgba(244, 63, 94, ${rip.alpha})` // Rose Pink for Assistant
          : `rgba(56, 189, 248, ${rip.alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = isUserSpeaking ? '#10b981' : '#f43f5e';
        ctx.stroke();
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 2. Radial Audio Frequency Equalizer Bars (Encircling the Orb)
      // -------------------------------------------------------------
      const baseGap = 6; // distance from orb perimeter to bar start
      const maxBarLen = isSpeaking ? 42 : isUserSpeaking ? 40 : isListening ? 22 : 12;

      ctx.save();
      for (let i = 0; i < BAR_COUNT; i++) {
        // Distribute evenly around 360 degrees
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        const freqVal = smoothFreqs[i] || 0.05;

        // Bar length responsive to actual audio frequency
        const barLen = Math.max(4, freqVal * maxBarLen);

        const x1 = cx + Math.cos(angle) * (orbRadius + baseGap);
        const y1 = cy + Math.sin(angle) * (orbRadius + baseGap);
        const x2 = cx + Math.cos(angle) * (orbRadius + baseGap + barLen);
        const y2 = cy + Math.sin(angle) * (orbRadius + baseGap + barLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';

        // Dynamic Frequency Color Gradients
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        if (isUserSpeaking) {
          // Vibrant Emerald -> Electric Cyan -> Bright White Tip
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.95)');
          grad.addColorStop(0.65, 'rgba(16, 185, 129, 0.95)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
          ctx.shadowColor = 'rgba(16, 185, 129, 0.75)';
          ctx.shadowBlur = 8 + freqVal * 12;
        } else if (isSpeaking) {
          // Vibrant Magenta -> Rose Red -> Gold Tip
          grad.addColorStop(0, 'rgba(217, 70, 239, 0.95)');
          grad.addColorStop(0.65, 'rgba(244, 63, 94, 0.95)');
          grad.addColorStop(1, 'rgba(255, 241, 242, 0.95)');
          ctx.shadowColor = 'rgba(244, 63, 94, 0.75)';
          ctx.shadowBlur = 8 + freqVal * 12;
        } else if (isThinking) {
          // Amber / Gold radar
          grad.addColorStop(0, 'rgba(139, 92, 246, 0.75)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0.95)');
          ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
          ctx.shadowBlur = 6;
        } else if (isListening) {
          // Sky Blue -> Cyan Active Listening Shimmer
          grad.addColorStop(0, 'rgba(14, 165, 233, 0.75)');
          grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.9)');
          grad.addColorStop(1, 'rgba(224, 242, 254, 0.95)');
          ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
          ctx.shadowBlur = 6 + freqVal * 8;
        } else {
          // Idle subtle sky tint
          grad.addColorStop(0, 'rgba(148, 163, 184, 0.35)');
          grad.addColorStop(1, 'rgba(186, 230, 253, 0.45)');
          ctx.shadowBlur = 0;
        }

        ctx.strokeStyle = grad;
        ctx.stroke();
      }
      ctx.restore();

      // -------------------------------------------------------------
      // 3. Fluid Sinusoidal Waveform Ribbon (Connecting the Audio Wave)
      // -------------------------------------------------------------
      if (isUserSpeaking || isSpeaking || isListening) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= BAR_COUNT; i++) {
          const idx = i % BAR_COUNT;
          const angle = (idx / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
          const freqVal = smoothFreqs[idx] || 0.05;
          const ribbonRadius = orbRadius + baseGap + freqVal * (maxBarLen * 0.75);
          const rx = cx + Math.cos(angle) * ribbonRadius;
          const ry = cy + Math.sin(angle) * ribbonRadius;

          if (i === 0) {
            ctx.moveTo(rx, ry);
          } else {
            ctx.lineTo(rx, ry);
          }
        }
        ctx.closePath();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = isUserSpeaking
          ? 'rgba(52, 211, 153, 0.65)'
          : isSpeaking
          ? 'rgba(244, 63, 94, 0.65)'
          : 'rgba(56, 189, 248, 0.45)';
        ctx.stroke();
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 4. Floating Ambient Particle Dust
      // -------------------------------------------------------------
      const baseParticleRadius = Math.min(w, h) * (0.35 + smooth * 0.06);

      for (const p of particles) {
        const speedMultiplier = isThinking ? 2.8 : isSpeaking || isUserSpeaking ? 1.7 : 1.0;
        const a = p.a + t * p.speed * speedMultiplier;
        const pulse = 0.92 + 0.08 * Math.sin(t * 0.0014 + p.phase);
        const px = cx + Math.cos(a) * baseParticleRadius * p.r * pulse;
        const py = cy + Math.sin(a) * baseParticleRadius * p.r * pulse;

        ctx.beginPath();
        const alpha = p.alpha * (0.7 + 0.3 * Math.sin(t * 0.002 + p.phase)) * (1 + smooth * 0.85);

        if (isSpeaking) {
          ctx.fillStyle = `rgba(244, ${Math.round(63 + smooth * 60)}, ${Math.round(140 + smooth * 80)}, ${Math.min(0.95, alpha)})`;
        } else if (isUserSpeaking) {
          ctx.fillStyle = `rgba(16, ${Math.round(185 + smooth * 40)}, ${Math.round(129 + smooth * 70)}, ${Math.min(0.95, alpha)})`;
        } else if (isThinking) {
          ctx.fillStyle = `rgba(245, ${Math.round(158 + smooth * 40)}, 11, ${Math.min(0.9, alpha)})`;
        } else {
          ctx.fillStyle = `rgba(130, ${Math.round(230 + smooth * 25)}, 255, ${Math.min(0.85, alpha)})`;
        }

        ctx.arc(px, py, p.s * (1 + smooth * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const animate = (t: number) => {
      if (!isRunning) return;

      const rawLevel = updateAudioData(t);
      voiceLevelRef.current = rawLevel;

      // Smooth attack and gentle decay for orb physics
      const attack = rawLevel > smoothVoiceRef.current ? 0.42 : 0.14;
      smoothVoiceRef.current += (rawLevel - smoothVoiceRef.current) * attack;
      const smooth = smoothVoiceRef.current;

      // Cursor smoothing with lerp
      const target = targetPointerRef.current;
      currentPointerRef.current.x += (target.x - currentPointerRef.current.x) * 0.1;
      currentPointerRef.current.y += (target.y - currentPointerRef.current.y) * 0.1;

      const curX = currentPointerRef.current.x;
      const curY = currentPointerRef.current.y;

      const state = visualStateRef.current;

      // Eye positions & dynamic focus when listening to speech
      const dx = curX * 11;
      const dy = curY * 9;
      const tilt = curX * 6;

      // When user is speaking into mic, eyes widen with attentive listening focus
      const eyeHeightMultiplier = state === 'user-speaking' ? 1 + smooth * 0.15 : 1;

      if (leftEyeRef.current) {
        leftEyeRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${tilt}deg) scaleY(${eyeHeightMultiplier})`;
      }
      if (rightEyeRef.current) {
        rightEyeRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${tilt}deg) scaleY(${eyeHeightMultiplier})`;
      }

      // 3D Orb tilt & CSS voice variable
      if (orbRef.current) {
        const tiltX = -curY * 3.5;
        const tiltY = curX * 3.5;
        orbRef.current.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${1 + smooth * 0.065})`;
        orbRef.current.style.setProperty('--voice', smooth.toFixed(3));
      }

      if (haloRef.current) {
        haloRef.current.style.setProperty('--voice', smooth.toFixed(3));
      }

      renderCanvas(t, smooth, state);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [particles]);

  // Pill description text based on state
  const pillLabel = useMemo(() => {
    switch (visualState) {
      case 'idle':
        return '✨ Neera • Standby / Ready';
      case 'connecting':
        return '🟡 Connecting to Neera…';
      case 'listening':
        return '🎧 Neera • Listening Hands-Free';
      case 'user-speaking':
        return '🎙️ Hearing Your Voice (Live Mic Frequency)';
      case 'thinking':
        return '💭 Neera • Verifying Sitemap Data…';
      case 'speaking':
        return '🔊 Neera • Speaking Answer';
      case 'muted':
        return '🔇 Microphone Muted';
      case 'error':
        return '⚠️ Connection Error';
    }
  }, [visualState]);

  const isLiveListeningOrSpeaking =
    visualState === 'user-speaking' || visualState === 'speaking' || visualState === 'listening';

  return (
    <div
      ref={stageRef}
      className={`neera-stage state-${visualState} ${className}`}
      aria-label="Neera AI Voice Assistant"
    >
      {/* Outer Atmospheric Halo */}
      <div ref={haloRef} className="neera-halo" aria-hidden="true" />

      {/* Dynamic Sound Wave & Voice Rings */}
      <div className="neera-voice-ring" aria-hidden="true" />
      <div className="neera-echo-ring" aria-hidden="true" />

      {/* The 3D Spherical Neera Character Orb */}
      <div
        ref={orbRef}
        className="neera-orb"
        onClick={onOrbClick}
        title={voiceState === 'live' ? 'Tap to end call' : 'Tap to start live call with Neera'}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOrbClick?.();
          }
        }}
      >
        <div className="neera-eye-pair">
          <div
            ref={leftEyeRef}
            className={`neera-eye ${isBlinking ? 'blinking' : ''}`}
            aria-hidden="true"
          />
          <div
            ref={rightEyeRef}
            className={`neera-eye ${isBlinking ? 'blinking' : ''}`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Dynamic Frequency Spectrum & Particle Canvas */}
      <canvas ref={canvasRef} className="neera-particle-canvas" aria-hidden="true" />

      {/* Status Pill Badge with Real-Time Frequency Equalizer Icon */}
      <div className="neera-status-pill">
        {isLiveListeningOrSpeaking ? (
          <div className="neera-pill-eq" aria-hidden="true">
            <span className="eq-bar b1" />
            <span className="eq-bar b2" />
            <span className="eq-bar b3" />
            <span className="eq-bar b4" />
            <span className="eq-bar b5" />
          </div>
        ) : (
          <span className="indicator-dot" />
        )}
        <span>{statusMessage || pillLabel}</span>
      </div>
    </div>
  );
}
