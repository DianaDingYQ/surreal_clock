/**
 * GuidePulse — shown on the idle/drawing screens.
 * Live webcam in the background + a faint oval guide + instruction.
 * Transitions seamlessly into ClockPreview and MeltingClock.
 */

import { useEffect, useRef } from 'react';

export default function GuidePulse({ videoRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let raf;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function render() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Webcam background (blurred, darkened) — same treatment as melt phase
      const video = videoRef?.current;
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.filter = 'blur(5px) brightness(0.55) saturate(0.70)';
        ctx.scale(-1, 1);
        ctx.drawImage(video, -W, 0, W, H);
        ctx.restore();
      } else {
        // Fallback: very dark solid
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, W, H);
      }

      // Faint oval guide — white dashed ring
      const cx = W / 2, cy = H / 2;
      const rx = Math.min(W, H) * 0.18;
      const ry = rx * 0.68;
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.0007);

      ctx.save();
      ctx.globalAlpha   = 0.12 + pulse * 0.10;
      ctx.strokeStyle   = '#ffffff';
      ctx.lineWidth     = 1.2;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = (Date.now() * 0.014) % 16;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      raf = requestAnimationFrame(render);
    }

    render();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
}
