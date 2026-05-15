/**
 * InkCanvas — dark ink strokes for the drawing phase.
 *
 * Key quality improvements vs v1:
 *  - Exponential low-pass filter smooths out hand-tracking jitter in real time
 *  - Catmull-Rom through the smoothed positions for an organic ink feel
 *  - Fades out gracefully when phase leaves 'drawing'
 */

import { useEffect, useRef, useCallback } from 'react';

// White ink on dark/webcam background
const INK = 'rgba(255, 255, 255, 0.88)';

function traceCatmullRom(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y
    );
  }
}

export default function InkCanvas({ pathRef, fingertip, phase, videoRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef(phase);
  const tipRef = useRef(fingertip);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { tipRef.current = fingertip; }, [fingertip]);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function render() {
      const pts = pathRef.current;
      const p = phaseRef.current;
      const tip = tipRef.current;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Webcam background during drawing (same treatment as other phases)
      const video = videoRef?.current;
      if (video && video.readyState >= 2 && p === 'drawing') {
        ctx.save();
        ctx.filter = 'blur(5px) brightness(0.55) saturate(0.70)';
        ctx.scale(-1, 1);
        ctx.drawImage(video, -W, 0, W, H);
        ctx.restore();
      }

      // Draw path
      if (pts.length >= 2 && (p === 'drawing' || p === 'preview')) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(18,16,28,0.12)';
        ctx.shadowBlur = 6;
        traceCatmullRom(ctx, pts);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Fingertip indicator
      if (tip?.detected && p === 'drawing') {
        const tx = tip.x * W;
        const ty = tip.y * H;
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.arc(tx, ty, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pathRef]);

  const visible = phase === 'drawing';

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10, opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}
    />
  );
}
