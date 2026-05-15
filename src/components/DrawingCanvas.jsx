/**
 * DrawingCanvas
 *
 * Fullscreen canvas for the drawing path. Uses refs for all changing values
 * inside the RAF loop to avoid stale closures — a common React + canvas pitfall.
 */

import { useEffect, useRef, useCallback } from 'react';
import { drawGlowingPath, drawFingertipDot, clearCanvas } from '../utils/canvasEffects';

const SHAPE_COLORS = {
  circle: '#c8a0ff',
  square: '#80c8ff',
  triangle: '#ffe080',
  blob: '#80ffb0',
  default: '#e0e0ff',
};

export default function DrawingCanvas({ pathRef, fingertip, phase, detectedShape }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Refs for RAF loop — prevents stale closure on prop changes
  const phaseRef = useRef(phase);
  const fingertipRef = useRef(fingertip);
  const shapeRef = useRef(detectedShape);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { fingertipRef.current = fingertip; }, [fingertip]);
  useEffect(() => { shapeRef.current = detectedShape; }, [detectedShape]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  // Single long-lived RAF loop — reads latest values via refs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function render() {
      const pts = pathRef.current;
      const p = phaseRef.current;
      const tip = fingertipRef.current;
      const shape = shapeRef.current;
      const color = SHAPE_COLORS[shape] ?? SHAPE_COLORS.default;
      const W = canvas.width;
      const H = canvas.height;

      clearCanvas(ctx, W, H);

      if (pts.length > 1 && (p === 'drawing' || p === 'confirming')) {
        drawGlowingPath(ctx, pts, color, 2.5, 20);
      }

      if (tip?.detected && p === 'drawing') {
        const px = tip.x * W;
        const py = tip.y * H;
        drawFingertipDot(ctx, px, py, color);
      }

      // Pulsing glow when shape is confirmed
      if (p === 'confirming' && pts.length > 1) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
        drawGlowingPath(ctx, pts, color, 3, 28 + pulse * 20);
      }

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pathRef]); // stable refs — no re-setup needed

  const visible = ['idle', 'drawing', 'confirming'].includes(phase);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease' }}
    />
  );
}
