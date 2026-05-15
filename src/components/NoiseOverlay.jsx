/**
 * NoiseOverlay
 *
 * Renders an animated film-grain texture over the entire experience.
 * Runs at ~24fps to match classic celluloid feel without burning CPU.
 * pointer-events: none ensures it never blocks interaction.
 */

import { useEffect, useRef } from 'react';
import { renderNoise } from '../utils/canvasEffects';

const GRAIN_FPS = 24;
const FRAME_INTERVAL = 1000 / GRAIN_FPS;

export default function NoiseOverlay() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let lastTime = 0;
    let raf;

    function resize() {
      // Use reduced resolution for performance — grain is low-frequency
      canvas.width = Math.ceil(window.innerWidth / 2);
      canvas.height = Math.ceil(window.innerHeight / 2);
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - lastTime < FRAME_INTERVAL) return;
      lastTime = now;
      renderNoise(ctx, canvas.width, canvas.height, 0.04);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
        opacity: 0.18,
        mixBlendMode: 'multiply',
        zIndex: 9998,
      }}
    />
  );
}
