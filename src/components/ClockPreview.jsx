/**
 * ClockPreview — static material preview before the generation animation.
 * No fisheye (no video needed in static preview).
 * Matches the chrome/glass material of InteractiveClock.
 */

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { traceMeltedClock, drawClockFace } from '../utils/clockGeometry';

function renderPreview(canvas, ellipse) {
  const ctx = canvas.getContext('2d');
  const { cx, cy, rx, ry } = ellipse;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Drop shadow
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.72)';
  ctx.shadowBlur    = 50;
  ctx.shadowOffsetX = rx * 0.07;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle     = 'rgba(0,0,0,0.01)';
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.fill();
  ctx.restore();

  // Dark interior — a slightly warm dark base
  ctx.save();
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.clip();
  ctx.fillStyle = 'rgba(18,16,28,0.82)';
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.fill();

  // Chrome gradient — high contrast wrap
  const chrome = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  chrome.addColorStop(0,    'rgba(255,255,255,0.45)');
  chrome.addColorStop(0.12, 'rgba(210,206,230,0.18)');
  chrome.addColorStop(0.35, 'rgba(18, 16, 30, 0.52)');
  chrome.addColorStop(0.62, 'rgba(10,  8, 20, 0.38)');
  chrome.addColorStop(0.82, 'rgba(155,150,178,0.35)');
  chrome.addColorStop(1,    'rgba(240,238,255,0.52)');
  ctx.fillStyle = chrome;
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.fill();

  // Radial vignette
  const vig = ctx.createRadialGradient(cx, cy - ry * 0.08, 0, cx, cy, Math.max(rx, ry) * 1.08);
  vig.addColorStop(0,   'transparent');
  vig.addColorStop(0.5, 'transparent');
  vig.addColorStop(1,   'rgba(0,0,0,0.58)');
  ctx.fillStyle = vig;
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.fill();

  // Primary specular crescent
  const hl1x = cx - rx * 0.28, hl1y = cy - ry * 0.48;
  const hl1  = ctx.createRadialGradient(hl1x, hl1y, 0, hl1x, hl1y, rx * 0.50);
  hl1.addColorStop(0,    'rgba(255,255,255,0.88)');
  hl1.addColorStop(0.28, 'rgba(255,255,255,0.32)');
  hl1.addColorStop(0.65, 'rgba(255,255,255,0.05)');
  hl1.addColorStop(1,    'transparent');
  ctx.fillStyle = hl1;
  ctx.beginPath();
  ctx.ellipse(hl1x, hl1y, rx * 0.46, ry * 0.28, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Secondary micro-highlights
  [[cx + rx * 0.62, cy - ry * 0.22, rx * 0.10, 0.68],
   [cx - rx * 0.55, cy + ry * 0.40, rx * 0.07, 0.42]].forEach(([hx, hy, hr, opa]) => {
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    hg.addColorStop(0, `rgba(255,255,255,${opa})`);
    hg.addColorStop(1, 'transparent');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();

  // Clock face
  ctx.save();
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.clip();
  drawClockFace(ctx, cx, cy, rx, ry, { meltT: 0, alpha: 0.72 });
  ctx.restore();

  // Glass rim — outer glow
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.25)';
  ctx.shadowBlur  = 12;
  const rim = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  rim.addColorStop(0,   'rgba(255,255,255,0.95)');
  rim.addColorStop(0.20,'rgba(225,222,245,0.80)');
  rim.addColorStop(0.50,'rgba(100, 96,120,0.52)');
  rim.addColorStop(0.78,'rgba(198,195,218,0.76)');
  rim.addColorStop(1,   'rgba(250,248,255,0.90)');
  ctx.strokeStyle = rim;
  ctx.lineWidth   = 4;
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.stroke();
  ctx.restore();

  // Inner dark line
  ctx.save();
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth   = 3;
  traceMeltedClock(ctx, cx, cy, rx, ry, 0);
  ctx.stroke();
  ctx.restore();
}

export default function ClockPreview({ ellipse, videoRef, onDrawAgain, onMelt }) {
  const canvasRef  = useRef(null);
  const bgCanvasRef = useRef(null);
  const bgRafRef   = useRef(null);

  // Live webcam background
  useEffect(() => {
    const bg = bgCanvasRef.current;
    if (!bg) return;
    function resize() {
      bg.width  = window.innerWidth;
      bg.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    const bctx = bg.getContext('2d');
    function renderBg() {
      const video = videoRef?.current;
      if (video && video.readyState >= 2) {
        bctx.save();
        bctx.filter = 'blur(4px) brightness(0.60) saturate(0.72)';
        bctx.scale(-1, 1);
        bctx.drawImage(video, -bg.width, 0, bg.width, bg.height);
        bctx.restore();
      }
      bgRafRef.current = requestAnimationFrame(renderBg);
    }
    bgRafRef.current = requestAnimationFrame(renderBg);
    return () => {
      cancelAnimationFrame(bgRafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [videoRef]);

  // Static clock render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ellipse) return;
    function draw() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      renderPreview(canvas, ellipse);
    }
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [ellipse]);

  if (!ellipse) return null;
  const { cx, cy, rx, ry } = ellipse;
  const buttonY = cy + ry + 48;

  return (
    <motion.div
      className="fixed inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ zIndex: 30 }}
    >
      <canvas ref={bgCanvasRef}  className="absolute inset-0 w-full h-full pointer-events-none" />
      <canvas ref={canvasRef}    className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Label */}
      <motion.p
        className="absolute"
        style={{
          left: cx, top: cy - ry - 38,
          transform: 'translateX(-50%)',
          fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
          letterSpacing: '0.38em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
        }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
      >
        Clock detected
      </motion.p>

      {/* Action buttons */}
      <motion.div
        className="absolute flex gap-10 items-center"
        style={{ left: cx, top: buttonY, transform: 'translateX(-50%)' }}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
      >
        <button
          onClick={onDrawAgain}
          style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
            letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none',
            cursor: 'pointer', transition: 'color 0.2s', padding: '8px 0',
          }}
          onMouseEnter={(e) => (e.target.style.color = 'rgba(255,255,255,0.70)')}
          onMouseLeave={(e) => (e.target.style.color = 'rgba(255,255,255,0.28)')}
        >
          Draw Again
        </button>

        <button
          onClick={onMelt}
          style={{
            fontFamily: '"Cormorant Garamond", serif', fontSize: '14px',
            fontStyle: 'italic', letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.85)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.25)',
            cursor: 'pointer', padding: '8px 22px', transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.background  = 'rgba(255,255,255,0.12)';
            e.target.style.borderColor = 'rgba(255,255,255,0.55)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background  = 'rgba(255,255,255,0.06)';
            e.target.style.borderColor = 'rgba(255,255,255,0.25)';
          }}
        >
          Materialize
        </button>
      </motion.div>
    </motion.div>
  );
}
