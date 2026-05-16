import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { useHands } from './hooks/useHands';
import { SurrealClock } from './components/SurrealClock';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import * as Tone from 'tone';
import { LucideClock, LucideLayers, LucideWaves, LucideSparkles } from 'lucide-react';

type Point = { x: number; y: number };

enum AppPhase {
  IDLE = 'IDLE',
  DRAWING = 'DRAWING',
  GENERATING = 'GENERATING',
  INTERACTING = 'INTERACTING'
}

export default function App() {
  const { videoRef, results, isReady } = useHands();
  const [phase, setPhase] = useState<AppPhase>(AppPhase.IDLE);
  const [points, setPoints] = useState<Point[]>([]);
  const smoothedPoint = useRef<Point | null>(null);
  const smoothingFactor = 0.25; // Lower = smoother but more lag

  const [clockPoints, setClockPoints] = useState<Point[]>([]);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const [materialConfig, setMaterialConfig] = useState({
    roughness: 0,
    metalness: 1,
    distortion: 1.2,
    ior: 1.6
  });
  
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const feedbackDelayRef = useRef<Tone.FeedbackDelay | null>(null);

  // Initialize Audio
  useEffect(() => {
    filterRef.current = new Tone.Filter(2000, "lowpass").toDestination();
    feedbackDelayRef.current = new Tone.FeedbackDelay("8n", 0.5).connect(filterRef.current);
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.2, sustain: 1, release: 0.8 }
    }).connect(feedbackDelayRef.current);

    return () => {
      synthRef.current?.dispose();
      filterRef.current?.dispose();
    };
  }, []);

  // Initialize video texture
  useEffect(() => {
    if (isReady && videoRef.current) {
      const tex = new THREE.VideoTexture(videoRef.current);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.format = THREE.RGBAFormat;
      setVideoTexture(tex);
    }
  }, [isReady]);

  // Interaction Point Memo
  const interactionPoint = useMemo(() => {
    if (phase === AppPhase.INTERACTING && results?.multiHandLandmarks?.[0]) {
      const raw = results.multiHandLandmarks[0][8];
      // Reuse smoothing for interaction too
      if (!smoothedPoint.current) {
        smoothedPoint.current = { x: raw.x, y: raw.y };
      } else {
        smoothedPoint.current.x += (raw.x - smoothedPoint.current.x) * smoothingFactor;
        smoothedPoint.current.y += (raw.y - smoothedPoint.current.y) * smoothingFactor;
      }
      return { ...smoothedPoint.current };
    }
    return null;
  }, [results, phase]);

  const interactionScale = useMemo(() => {
    if (phase !== AppPhase.INTERACTING || !results?.multiHandLandmarks?.[0]) return 1;

    const landmarks = results.multiHandLandmarks[0];
    const thumb = landmarks[4];
    const index = landmarks[8];
    const pinchDistance = Math.hypot(index.x - thumb.x, index.y - thumb.y);

    return THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(pinchDistance, 0.035, 0.22, 0.55, 1.95), 0.55, 1.95);
  }, [results, phase]);

  const prevPointsLength = useRef(0);
  useEffect(() => {
    prevPointsLength.current = points.length;
  }, [points]);

  const completionTriggered = useRef(false);

  const handleCompleteDrawing = useCallback((finalPoints: Point[]) => {
    if (phase !== AppPhase.DRAWING || completionTriggered.current) return;
    completionTriggered.current = true;
    setClockPoints([...finalPoints]);
    setPhase(AppPhase.GENERATING);
    Tone.start().catch(console.error);
  }, [phase]);

  useEffect(() => {
    if (phase !== AppPhase.GENERATING || clockPoints.length === 0) return;

    const materializeTimer = window.setTimeout(() => {
      setPhase(AppPhase.INTERACTING);

      window.setTimeout(() => {
        completionTriggered.current = false;
      }, 500);
    }, 1200);

    return () => window.clearTimeout(materializeTimer);
  }, [phase, clockPoints.length]);

  // Sonification logic
  useEffect(() => {
    if (phase === AppPhase.INTERACTING && interactionPoint) {
      const freq = 100 + (1 - interactionPoint.y) * 400;
      synthRef.current?.set({ oscillator: { type: "sine" } });
      synthRef.current?.triggerAttack(freq, Tone.now(), 0.1);
      filterRef.current?.frequency.rampTo(freq * 2, 0.1);
    } else {
      synthRef.current?.releaseAll();
    }
  }, [interactionPoint, phase]);

  // Drawing logic with smoothing using functional updates to avoid dependency loops
  useEffect(() => {
    if (phase !== AppPhase.DRAWING || !results?.multiHandLandmarks?.[0]) {
      if (phase !== AppPhase.DRAWING && phase !== AppPhase.INTERACTING) {
        smoothedPoint.current = null;
      }
      return;
    }

    const raw = results.multiHandLandmarks[0][8];
    
    if (!smoothedPoint.current) {
      smoothedPoint.current = { x: raw.x, y: raw.y };
    } else {
      smoothedPoint.current.x += (raw.x - smoothedPoint.current.x) * smoothingFactor;
      smoothedPoint.current.y += (raw.y - smoothedPoint.current.y) * smoothingFactor;
    }

    const nextPoint = { x: smoothedPoint.current.x, y: smoothedPoint.current.y };
    
    setPoints(prev => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = Math.sqrt(Math.pow(nextPoint.x - last.x, 2) + Math.pow(nextPoint.y - last.y, 2));
        if (dist < 0.015) return prev;
      }
      return [...prev, nextPoint];
    });

    // Check for completion outside setPoints to avoid side effects during state update
    if (points.length > 40) {
      const start = points[0];
      const distToStart = Math.sqrt(Math.pow(nextPoint.x - start.x, 2) + Math.pow(nextPoint.y - start.y, 2));
      if (distToStart < 0.12) {
        handleCompleteDrawing([...points, { ...start }]);
      }
    }
  }, [results, phase, points, handleCompleteDrawing]);

  const reset = () => {
    setPoints([]);
    setClockPoints([]);
    setPhase(AppPhase.IDLE);
    completionTriggered.current = false;
  };

  return (
    <div className="relative w-full h-screen bg-[#E6E2DE] overflow-hidden font-sans cursor-none">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_70%_30%,#FDFCFB_0%,#E6E2DE_50%,#D8D2CB_100%)] opacity-80" />
      <div className="absolute inset-0 z-0 pointer-events-none opacity-5" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,rgba(216,210,203,0)_70%)] z-0" />

      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover opacity-20 z-0"
        autoPlay playsInline muted
        style={{ transform: 'scaleX(-1)' }}
      />

      <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full" style={{ transform: 'scaleX(-1)' }}>
        {phase === AppPhase.DRAWING && points.length > 0 && (
          <motion.circle
            cx={`${points[0].x * 100}%`}
            cy={`${points[0].y * 100}%`}
            r="12"
            fill="rgba(255, 255, 255, 0.2)"
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            initial={{ scale: 0 }}
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.8, 0.3]
            }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        )}
        {points.length > 1 && (
          <motion.path
            d={`M ${points[0].x * 100}% ${points[0].y * 100}% ` + points.slice(1).map(p => `L ${p.x * 100}% ${p.y * 100}%`).join(' ')}
            fill="none" 
            stroke="url(#grad)" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0.5 }} />
            <stop offset="100%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute inset-0 z-20 pointer-events-none">
        <Canvas shadows gl={{ antialias: true, alpha: true }}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
          
          {phase === AppPhase.INTERACTING && (
            <SurrealClock 
              points={clockPoints} 
              videoTexture={videoTexture}
              interactionPoint={interactionPoint}
              interactionScale={interactionScale}
              materialConfig={materialConfig}
            />
          )}
          <Environment preset="city" />
        </Canvas>
      </div>

      <div className="absolute top-12 left-12 z-40 pointer-events-none flex flex-col space-y-1">
        <div className="text-[10px] tracking-[0.3em] uppercase text-black/40 font-semibold">Project: Surreal Hands</div>
        <div className="text-2xl font-light tracking-tighter text-black/80 font-serif italic">Liquid Time Sculpture v.01</div>
      </div>

      <div className="absolute top-12 right-12 z-40 pointer-events-none flex flex-col items-end">
        <div className="w-10 h-[1px] bg-black/20 mb-4" />
        <div className="text-[10px] text-right leading-relaxed text-black/40 max-w-[140px]">
          Sonified interactive mirror dynamics with real-time hand tracking.
        </div>
      </div>

      {/* Material Customization Panel */}
      <AnimatePresence>
        {phase === AppPhase.INTERACTING && (
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute right-12 top-1/2 -translate-y-1/2 z-40 bg-white/20 backdrop-blur-xl border border-white/40 p-6 rounded-3xl space-y-8 pointer-events-auto"
          >
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[9px] tracking-widest uppercase text-black/40 font-bold">
                <LucideWaves className="w-3 h-3" /> Distortion
              </label>
              <input 
                type="range" min="0" max="3" step="0.1" 
                value={materialConfig.distortion} 
                onChange={(e) => setMaterialConfig({...materialConfig, distortion: parseFloat(e.target.value)})}
                className="w-32 accent-black/40"
              />
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[9px] tracking-widest uppercase text-black/40 font-bold">
                <LucideSparkles className="w-3 h-3" /> Refraction
              </label>
              <input 
                type="range" min="1" max="2.5" step="0.1" 
                value={materialConfig.ior} 
                onChange={(e) => setMaterialConfig({...materialConfig, ior: parseFloat(e.target.value)})}
                className="w-32 accent-black/40"
              />
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[9px] tracking-widest uppercase text-black/40 font-bold">
                <LucideLayers className="w-3 h-3" /> Roughness
              </label>
              <input 
                type="range" min="0" max="1" step="0.05" 
                value={materialConfig.roughness} 
                onChange={(e) => setMaterialConfig({...materialConfig, roughness: parseFloat(e.target.value)})}
                className="w-32 accent-black/40"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-end pb-12">
        <AnimatePresence mode="wait">
          {phase === AppPhase.IDLE && (
            <motion.div
              key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center space-y-4"
            >
              <button 
                onClick={() => setPhase(AppPhase.DRAWING)}
                className="pointer-events-auto text-[11px] tracking-[0.2em] uppercase text-black/50 bg-white/40 px-8 py-3 rounded-full backdrop-blur-md border border-white/50 hover:bg-white/60 transition-all active:scale-95 shadow-sm"
              >
                Draw a shape in the air
              </button>
              <div className="flex space-x-8 text-[9px] tracking-[0.1em] uppercase text-black/30">
                <div className="flex items-center"><span className="w-1 h-1 bg-black/30 rounded-full mr-2"></span> Camera Active</div>
                <div className="flex items-center"><span className="w-1 h-1 bg-black/30 rounded-full mr-2"></span> Sound Enabled</div>
              </div>
            </motion.div>
          )}

          {phase === AppPhase.INTERACTING && (
            <motion.div
              key="interacting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto"
            >
              <button 
                onClick={reset}
                className="group flex items-center space-x-3 bg-white/20 hover:bg-white/40 backdrop-blur-md border border-white/40 px-6 py-2 rounded-full transition-all"
              >
                <LucideClock className="w-4 h-4 text-black/60 group-hover:text-black" />
                <span className="text-[10px] tracking-[0.1em] uppercase text-black/60 group-hover:text-black">Reset Time</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === AppPhase.GENERATING && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="w-16 h-16 border-t-2 border-black/20 rounded-full animate-spin" />
            <div className="text-[10px] tracking-[0.4em] uppercase text-black/60 font-medium">Materializing Sculpture...</div>
          </motion.div>
        )}

        {phase === AppPhase.DRAWING && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-6">
            <div className="text-[10px] tracking-[0.4em] uppercase text-black/40 animate-pulse">Tracing Path...</div>
            <div className="flex flex-col items-center space-y-2">
              <div className="text-[9px] tracking-widest text-black/30 uppercase">Return to the start to close the loop</div>
              {points.length > 30 && (
                <button 
                  onClick={() => handleCompleteDrawing(points)}
                  className="pointer-events-auto text-[9px] tracking-widest uppercase text-white bg-black/40 hover:bg-black/60 px-4 py-2 rounded-full backdrop-blur-md transition-all active:scale-95"
                >
                  Or Click to Close
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none z-50 border-[32px] border-transparent shadow-[inset_0_0_100px_rgba(255,255,255,0.4)]" />

      {results?.multiHandLandmarks?.[0] && (
        <div 
          className="absolute z-50 pointer-events-none w-3 h-3 bg-white/40 rounded-full border border-white/60 backdrop-blur-sm -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
          style={{ 
            left: `${(1 - results.multiHandLandmarks[0][8].x) * 100}%`, 
            top: `${results.multiHandLandmarks[0][8].y * 100}%`,
            transform: `translate(-50%, -50%) scale(${phase === AppPhase.DRAWING ? 2 : 1})`
          }}
        />
      )}
      
      <style>{`
        body { margin: 0; cursor: none; }
        ::-webkit-scrollbar { display: none; }
        input[type=range] {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
