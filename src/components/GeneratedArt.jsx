/**
 * GeneratedArt
 *
 * Handles the generation phase and final art reveal.
 *
 * Flow:
 *   1. Mount → start generating (call generateImage with prompt)
 *   2. While waiting → show pulsing atmospheric loading animation
 *   3. On resolve → if URL returned, draw to canvas; else run generativeArt() fallback
 *   4. Overlay prompt text as elegant typography
 *
 * To plug in a real AI backend: update generateImage() in promptGenerator.js.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateImage } from '../utils/promptGenerator';
import { startGenerativeArt } from '../utils/generativeArt';

export default function GeneratedArt({ shape, prompt, onReset }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('generating'); // 'generating' | 'revealed'
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!prompt) return;
    let cleanup = null;

    async function run() {
      setStatus('generating');
      setShowPrompt(false);

      const imageUrl = await generateImage(prompt);

      setStatus('revealed');

      // Small delay before showing prompt text for cinematic feel
      setTimeout(() => setShowPrompt(true), 900);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      if (imageUrl) {
        // Real AI image — draw it to canvas
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          cleanup = startGenerativeArt(canvas, shape); // layered on top
        };
        img.src = imageUrl;
      } else {
        // Placeholder generative art
        cleanup = startGenerativeArt(canvas, shape);
      }
    }

    run();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [prompt, shape]);

  return (
    <div className="fixed inset-0">
      {/* Generated / generative art canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Loading state */}
      <AnimatePresence>
        {status === 'generating' && (
          <motion.div
            key="loading"
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Pulsing rings */}
            <div className="relative w-24 h-24 flex items-center justify-center mb-10">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-white/20"
                  style={{ width: 40 + i * 28, height: 40 + i * 28 }}
                  animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.1, 0.4] }}
                  transition={{ duration: 2.5, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
              <motion.div
                className="w-3 h-3 rounded-full bg-white"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>

            <motion.p
              className="font-mono text-xs tracking-[0.4em] text-white/40 uppercase"
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              GENERATING
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* Prompt text reveal */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            key="prompt"
            className="absolute bottom-0 left-0 right-0 px-12 pb-14"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            <p
              className="font-display text-base text-white/55 leading-relaxed max-w-2xl italic"
              style={{ fontWeight: 300 }}
            >
              "{prompt}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset button */}
      <AnimatePresence>
        {status === 'revealed' && (
          <motion.button
            key="reset"
            className="absolute top-8 right-10 font-mono text-[11px] tracking-[0.3em] text-white/25 hover:text-white/60 transition-colors uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2, duration: 1 }}
            onClick={onReset}
          >
            DRAW AGAIN
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
