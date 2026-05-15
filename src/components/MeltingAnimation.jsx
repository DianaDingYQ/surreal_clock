/**
 * MeltingAnimation
 *
 * Canvas-based melting/liquification sequence.
 * Takes the drawn path and runs it through a multi-phase distortion:
 *
 *   Phase 0-0.3  : Subtle wobble begins
 *   Phase 0.3-0.6: Amplitude increases, drip particles spawn
 *   Phase 0.6-0.9: Heavy distortion, blur, drips accelerate
 *   Phase 0.9-1.0: Fade to black
 *
 * Calls onComplete() when the sequence finishes.
 */

import { useEffect, useRef } from 'react';
import { drawGlowingPath, drawDrip, clearCanvas } from '../utils/canvasEffects';

const DURATION_MS = 3800;

function createDrip(pts, color) {
  const idx = Math.floor(Math.random() * pts.length);
  const origin = pts[idx] ?? pts[0];
  return {
    x: origin.x + (Math.random() - 0.5) * 12,
    y: origin.y,
    vy: 0.3 + Math.random() * 1.5,
    radius: 2 + Math.random() * 5,
    opacity: 0.8 + Math.random() * 0.2,
    color,
    trail: [],
  };
}

const SHAPE_COLORS = {
  circle: '#c8a0ff',
  square: '#80c8ff',
  triangle: '#ffe080',
  blob: '#80ffb0',
};

export default function MeltingAnimation({ path, detectedShape, onComplete }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!path?.length) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const color = SHAPE_COLORS[detectedShape] ?? '#e0e0ff';
    const startTime = performance.now();
    let raf;
    const drips = [];

    function distortPts(pts, t) {
      const amp = t * 45;
      const speed = t * 3;
      return pts.map((p, i) => ({
        x: p.x + Math.sin(p.y * 0.018 + i * 0.22 + speed) * amp * (0.4 + 0.6 * Math.abs(Math.sin(i * 0.5))),
        y: p.y + Math.cos(p.x * 0.015 + i * 0.18 + speed * 0.7) * amp * 0.55
              + t * t * 60, // gravity pull downward
      }));
    }

    function render(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION_MS, 1);

      clearCanvas(ctx, canvas.width, canvas.height);

      // Phase-specific effects
      const distortT = Math.pow(Math.max(0, (t - 0.05) / 0.85), 1.4);
      const blurPx = t < 0.7 ? 0 : ((t - 0.7) / 0.3) * 14;
      const globalAlpha = t > 0.88 ? 1 - (t - 0.88) / 0.12 : 1;

      ctx.save();
      ctx.globalAlpha = globalAlpha;

      // Apply CSS filter blur via canvas filter (Chrome/FF support)
      if (blurPx > 0.5) {
        ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
      }

      // Distorted path
      const distorted = distortPts(path, distortT);
      const lineW = 2.5 + distortT * 2.5;
      const glow = 18 + distortT * 35;
      drawGlowingPath(ctx, distorted, color, lineW, glow);

      // Ghost echo — slightly less distorted trail for depth
      if (t > 0.2) {
        const ghost = distortPts(path, distortT * 0.55);
        ctx.globalAlpha = globalAlpha * 0.25;
        drawGlowingPath(ctx, ghost, color, lineW * 0.6, glow * 0.5);
        ctx.globalAlpha = globalAlpha;
      }

      ctx.filter = 'none';

      // Spawn drips after first 20%
      if (t > 0.18 && Math.random() < 0.25 + t * 0.4) {
        drips.push(createDrip(path, color));
      }

      // Update & draw drips
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        d.trail.push({ x: d.x, y: d.y });
        if (d.trail.length > 22) d.trail.shift();
        d.vy *= 1.025;
        d.y += d.vy;
        d.x += (Math.random() - 0.5) * 0.5; // micro-drift
        d.opacity -= 0.004 + t * 0.005;

        if (d.opacity <= 0 || d.y > canvas.height + 50) {
          drips.splice(i, 1);
        } else {
          drawDrip(ctx, d);
        }
      }

      ctx.restore();

      if (t < 1) {
        raf = requestAnimationFrame(render);
      } else {
        onComplete?.();
      }
    }

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [path, detectedShape, onComplete]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />;
}
