/**
 * AmbientBackground
 * Always-on canvas that renders slow organic motion behind everything.
 * Gives life to the "idle" state so it never reads as a broken black screen.
 */

import { useEffect, useRef } from 'react';

export default function AmbientBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // A handful of slow drifting light sources
    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: canvas.width * (0.15 + (i / 4) * 0.7),
      y: canvas.height * (0.2 + Math.random() * 0.6),
      r: Math.min(canvas.width, canvas.height) * (0.12 + Math.random() * 0.18),
      hue: 260 + i * 18,
      phase: i * 1.2,
      speed: 0.0008 + Math.random() * 0.0006,
    }));

    function render() {
      t += 0.016;
      const W = canvas.width;
      const H = canvas.height;

      // Slow fade to black each frame — creates smear motion
      ctx.fillStyle = 'rgba(8, 8, 8, 0.06)';
      ctx.fillRect(0, 0, W, H);

      orbs.forEach((orb) => {
        const ox = orb.x + Math.sin(t * orb.speed * 0.7 + orb.phase) * W * 0.1;
        const oy = orb.y + Math.cos(t * orb.speed + orb.phase * 1.3) * H * 0.08;
        const pulse = 1 + 0.12 * Math.sin(t * orb.speed * 3 + orb.phase);

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.r * pulse);
        grad.addColorStop(0, `hsla(${orb.hue}, 55%, 25%, 0.10)`);
        grad.addColorStop(0.5, `hsla(${orb.hue}, 40%, 15%, 0.04)`);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      });

      raf = requestAnimationFrame(render);
    }

    render();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
