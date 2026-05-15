/**
 * useAudioEngine — Web Audio API sound layer.
 * AudioContext is created lazily on first call (respects autoplay policy).
 */

import { useRef, useCallback, useMemo } from 'react';

function getCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}

export function useAudioEngine() {
  const actxRef   = useRef(null);
  const whisperRef = useRef(null);
  const humRef     = useRef(null);

  // ── Drawing whisper ────────────────────────────────────────────────────────
  const startDrawingSound = useCallback(() => {
    if (whisperRef.current) return;
    const ctx = getCtx(actxRef);
    const bufLen = ctx.sampleRate * 2;
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    src.loop     = true;

    const bpf    = ctx.createBiquadFilter();
    bpf.type     = 'bandpass';
    bpf.frequency.value = 2400;
    bpf.Q.value  = 0.6;

    const gain   = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 0.3);

    src.connect(bpf).connect(gain).connect(ctx.destination);
    src.start();
    whisperRef.current = { src, gain };
  }, []);

  const stopDrawingSound = useCallback(() => {
    if (!whisperRef.current) return;
    const { src, gain } = whisperRef.current;
    whisperRef.current = null;
    const ctx = getCtx(actxRef);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    setTimeout(() => { try { src.stop(); } catch {} }, 500);
  }, []);

  // ── Shape closure chime ────────────────────────────────────────────────────
  const playClosureChime = useCallback(() => {
    const ctx = getCtx(actxRef);
    const t   = ctx.currentTime;

    [[880, 0, 0.28, 0.9], [1320, 0.06, 0.14, 0.7], [2200, 0.12, 0.07, 0.5]].forEach(
      ([freq, delay, vol, dur]) => {
        const osc  = ctx.createOscillator();
        osc.type   = 'sine';
        osc.frequency.value = freq;
        const g    = ctx.createGain();
        g.gain.setValueAtTime(vol, t + delay);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.05);
      }
    );
  }, []);

  // ── Generation sequence sound (5 s sweep) ─────────────────────────────────
  const playGenerationSound = useCallback(() => {
    const ctx = getCtx(actxRef);
    const t   = ctx.currentTime;

    // Metallic sweep
    const osc = ctx.createOscillator();
    osc.type  = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(260, t + 3);

    const bpf = ctx.createBiquadFilter();
    bpf.type  = 'bandpass';
    bpf.frequency.setValueAtTime(500, t);
    bpf.frequency.linearRampToValueAtTime(1600, t + 3.5);
    bpf.Q.value = 10;

    const g   = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.6);
    g.gain.linearRampToValueAtTime(0.05, t + 2.5);
    g.gain.linearRampToValueAtTime(0, t + 4.8);

    osc.connect(bpf).connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 5);

    // Crystal overtone appears mid-way
    const bell  = ctx.createOscillator();
    bell.type   = 'sine';
    bell.frequency.value = 1760;
    const bellG = ctx.createGain();
    bellG.gain.setValueAtTime(0.06, t + 1.8);
    bellG.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
    bell.connect(bellG).connect(ctx.destination);
    bell.start(t + 1.8);
    bell.stop(t + 4.5);
  }, []);

  // ── Proximity hum (call each frame; distance 0=near, 1=far) ───────────────
  const updateProximityHum = useCallback((distance) => {
    const ctx = getCtx(actxRef);
    if (!humRef.current) {
      const osc  = ctx.createOscillator();
      osc.type   = 'sine';
      osc.frequency.value = 68;
      const g    = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(ctx.destination);
      osc.start();
      humRef.current = { osc, gain: g };
    }
    const targetGain = Math.max(0, (1 - distance) * 0.055);
    humRef.current.gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.06);
    humRef.current.osc.frequency.linearRampToValueAtTime(
      68 + (1 - distance) * 38, ctx.currentTime + 0.1
    );
  }, []);

  const stopProximityHum = useCallback(() => {
    if (!humRef.current) return;
    const ctx = getCtx(actxRef);
    humRef.current.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
  }, []);

  // ── Swipe ripple shimmer ───────────────────────────────────────────────────
  const playRippleSound = useCallback(() => {
    const ctx = getCtx(actxRef);
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.45);
    const g   = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.5);
  }, []);

  // ── Release plop ──────────────────────────────────────────────────────────
  const playReleaseSound = useCallback(() => {
    const ctx = getCtx(actxRef);
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);
    const g   = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.3);
  }, []);

  return useMemo(() => ({
    startDrawingSound, stopDrawingSound,
    playClosureChime, playGenerationSound,
    updateProximityHum, stopProximityHum,
    playRippleSound, playReleaseSound,
  }), [startDrawingSound, stopDrawingSound, playClosureChime, playGenerationSound,
        updateProximityHum, stopProximityHum, playRippleSound, playReleaseSound]);
}
