/**
 * HalftoneBackground
 *
 * Samples the live webcam feed and renders it as a halftone dot grid on a white canvas.
 * Dark pixels → large black circles. Bright pixels → no dot.
 * Creates the "museum installation camera presence" feel without a literal video feed.
 *
 * Performance: samples video at 1/GRID resolution via an offscreen canvas,
 * then renders dots on the main canvas. Runs at 24fps to stay light.
 */

import { useEffect, useRef } from 'react';

const GRID = 15;          // px between dot centres
const MAX_R = GRID * 0.46; // max dot radius
const FPS = 24;

export default function HalftoneBackground({ videoRef }) {
  const canvasRef = useRef(null);
  const offRef = useRef(null); // reusable offscreen canvas for sampling

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let lastTime = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Rebuild offscreen canvas to match new sample grid dimensions
      const cols = Math.ceil(canvas.width / GRID);
      const rows = Math.ceil(canvas.height / GRID);
      const off = document.createElement('canvas');
      off.width = cols;
      off.height = rows;
      offRef.current = off;
    }

    resize();
    window.addEventListener('resize', resize);

    function render(now) {
      raf = requestAnimationFrame(render);
      if (now - lastTime < 1000 / FPS) return;
      lastTime = now;

      const W = canvas.width;
      const H = canvas.height;
      const video = videoRef.current;
      const off = offRef.current;
      if (!off) return;

      // White paper background
      ctx.fillStyle = '#f5f5f3';
      ctx.fillRect(0, 0, W, H);

      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(render);
        return;
      }

      const cols = off.width;
      const rows = off.height;
      const octx = off.getContext('2d');

      // Sample video into tiny canvas (mirrored horizontally — selfie view)
      octx.save();
      octx.scale(-1, 1);
      octx.drawImage(video, -cols, 0, cols, rows);
      octx.restore();

      const { data } = octx.getImageData(0, 0, cols, rows);

      ctx.fillStyle = '#1a1a1a';
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const i = (row * cols + col) * 4;
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const darkness = 1 - luma / 255;

          // Only draw dots for meaningfully dark areas
          if (darkness < 0.08) continue;

          const r = MAX_R * Math.pow(darkness, 0.75); // gamma curve — more contrast
          const cx = col * GRID + GRID / 2;
          const cy = row * GRID + GRID / 2;

          ctx.globalAlpha = 0.75 + darkness * 0.25;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
