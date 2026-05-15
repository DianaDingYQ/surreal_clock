/**
 * InteractiveClock — the final surreal object.
 *
 * Rendering layers (front to back):
 *   0. Webcam bg  blur(4px) brightness(0.58)
 *   1. Drop shadow
 *   2. Fisheye with chromatic aberration (refractive glass distortion)
 *   3. High-contrast chrome gradient (wraps around the 3-D form)
 *   4. Radial vignette (edge darkening — "convex object" depth cue)
 *   5. Primary specular crescent (upper-left, very bright)
 *   6. Secondary micro-highlights (3 small rim catches)
 *   7. Caustic shimmer (2 drifting bright spots inside)
 *   8. Clock face elements (ticks, numerals, hands) — secondary / subtle
 *   9. Glass rim — thick stroke with inner-glow and outer halo
 *  10. Drip particles — chrome spheres
 *  11. Pinch proximity edge glow
 *  12. Swipe ripple rings
 */

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { traceMeltedClock, drawClockFace } from '../utils/clockGeometry';

// Fisheye constants — lower POWER = more extreme convex-mirror compression
const FACE_SCALE   = 0.50;
const SPREAD       = 2.0;
const POWER        = 0.38;  // strong fisheye / crystal-ball feel
const SAMPLE_SCALE = 0.35;
const CA           = 0.028; // chromatic aberration (color fringe at glass edges)

// Spring constants
const SPRING_K = 0.13;
const DAMPING  = 0.76;

const SWIPE_SPEED = 0.022;

function makeDrip(x, y) {
  return { x, y, vy: 0.4 + Math.random() * 0.8, r: 1.5 + Math.random() * 3.5,
           opacity: 0.9, trail: [] };
}

export default function InteractiveClock({ ellipse, videoRef, handData, onReset }) {
  const canvasRef  = useRef(null);
  const sampleRef  = useRef(null);
  const faceRef    = useRef(null);
  const springPos  = useRef(null);
  const springVel  = useRef({ x: 0, y: 0 });
  const pinchAnchorRef = useRef(null);
  const wasPinching    = useRef(false);
  const ripples    = useRef([]);
  const lastSwipe  = useRef(0);
  const handRef    = useRef(handData);
  useEffect(() => { handRef.current = handData; }, [handData]);

  useEffect(() => {
    sampleRef.current = document.createElement('canvas');
    faceRef.current   = document.createElement('canvas');
  }, []);

  useEffect(() => {
    if (!ellipse) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const { cx: baseCx, cy: baseCy, rx, ry } = ellipse;
    const W = canvas.width, H = canvas.height;
    springPos.current = { x: baseCx, y: baseCy };

    const sampleCanvas = sampleRef.current;
    const faceCanvas   = faceRef.current;
    const sW = Math.ceil(W * SAMPLE_SCALE), sH = Math.ceil(H * SAMPLE_SCALE);
    sampleCanvas.width  = sW; sampleCanvas.height = sH;
    faceCanvas.width    = Math.ceil(rx * 2 * FACE_SCALE);
    faceCanvas.height   = Math.ceil(ry * 2 * FACE_SCALE);
    const fW = faceCanvas.width, fH = faceCanvas.height;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const fCtx = faceCanvas.getContext('2d');

    // ── Fisheye with chromatic aberration ─────────────────────────────────
    function renderFisheye(video, renderCx, renderCy) {
      sCtx.save();
      sCtx.scale(-SAMPLE_SCALE, SAMPLE_SCALE);
      sCtx.drawImage(video, -W, 0, W, H);
      sCtx.restore();

      const src = sCtx.getImageData(0, 0, sW, sH);
      const dst = fCtx.createImageData(fW, fH);
      const vcx = (W - renderCx) * SAMPLE_SCALE;
      const vcy = renderCy * SAMPLE_SCALE;

      for (let py = 0; py < fH; py++) {
        for (let px = 0; px < fW; px++) {
          const nx = (px / fW - 0.5) * 2;
          const ny = (py / fH - 0.5) * 2;
          const r  = Math.hypot(nx, ny);
          if (r > 1.0) continue;

          const angle   = Math.atan2(ny, nx);
          const rSrc    = Math.pow(r, POWER) * SPREAD;

          // Chromatic aberration: R samples tighter (less dispersed), B wider
          const rSrcR   = rSrc * (1 - CA * r);
          const rSrcB   = rSrc * (1 + CA * r);

          function sample(rs, ch) {
            const sx = Math.max(0, Math.min(sW - 1,
              Math.round(vcx + Math.cos(angle) * rs * rx * SAMPLE_SCALE)));
            const sy = Math.max(0, Math.min(sH - 1,
              Math.round(vcy + Math.sin(angle) * rs * ry * SAMPLE_SCALE)));
            return src.data[(sy * sW + sx) * 4 + ch];
          }

          const di = (py * fW + px) * 4;
          dst.data[di]   = sample(rSrcR, 0); // R — tighter
          dst.data[di+1] = sample(rSrc,  1); // G — standard
          dst.data[di+2] = sample(rSrcB, 2); // B — wider
          dst.data[di+3] = 255;
        }
      }
      fCtx.putImageData(dst, 0, 0);
    }

    const drips = [];
    const start = performance.now();
    let raf;

    function render(now) {
      const elapsed = (now - start) / 1000;
      const meltT   = 1.0;
      const hd      = handRef.current;
      ctx.clearRect(0, 0, W, H);

      // ── Spring physics ──────────────────────────────────────────────────
      const isPinching = hd?.pinching && hd?.index;
      let targetX = baseCx, targetY = baseCy;

      if (isPinching) {
        const ix = hd.index.x * W, iy = hd.index.y * H;
        if (!wasPinching.current) {
          pinchAnchorRef.current = { ox: baseCx - ix, oy: baseCy - iy };
        }
        targetX = ix + (pinchAnchorRef.current?.ox ?? 0);
        targetY = iy + (pinchAnchorRef.current?.oy ?? 0);
      }
      wasPinching.current = isPinching;

      targetX = Math.max(rx + W * 0.06, Math.min(W - rx - W * 0.06, targetX));
      targetY = Math.max(ry + H * 0.06, Math.min(H - ry - H * 0.06, targetY));

      springVel.current.x = springVel.current.x * DAMPING + (targetX - springPos.current.x) * SPRING_K;
      springVel.current.y = springVel.current.y * DAMPING + (targetY - springPos.current.y) * SPRING_K;
      springPos.current.x += springVel.current.x;
      springPos.current.y += springVel.current.y;

      const cx = springPos.current.x;
      const cy = springPos.current.y;

      // ── Swipe detection ─────────────────────────────────────────────────
      if (hd?.velocity?.speed > SWIPE_SPEED && (now - lastSwipe.current) > 600) {
        lastSwipe.current = now;
        ripples.current.push({ t: 0, cx, cy });
      }

      const video = videoRef?.current;

      // ── 0. Background ───────────────────────────────────────────────────
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.filter = 'blur(4px) brightness(0.58) saturate(0.72)';
        ctx.scale(-1, 1);
        ctx.drawImage(video, -W, 0, W, H);
        ctx.restore();
      }

      // ── 1. Drop shadow — large, offset, dark ────────────────────────────
      ctx.save();
      ctx.shadowColor   = 'rgba(0,0,0,0.80)';
      ctx.shadowBlur    = 60 + meltT * 40;
      ctx.shadowOffsetX = rx * 0.08;
      ctx.shadowOffsetY = 28 + meltT * 32;
      ctx.fillStyle     = 'rgba(0,0,0,0.01)';
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.fill();
      ctx.restore();

      // ── 2. Fisheye (chromatic aberration refractive glass) ──────────────
      if (video && video.readyState >= 2) {
        renderFisheye(video, cx, cy);
      }
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(faceCanvas, cx - rx, cy - ry, rx * 2, ry * 2);
      ctx.restore();

      // ── 3. High-contrast chrome gradient ────────────────────────────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();

      // Simulates a chrome ball: very bright upper-left, very dark middle, bright lower-right rim
      const chrome = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      chrome.addColorStop(0,    'rgba(255,255,255,0.48)');
      chrome.addColorStop(0.12, 'rgba(220,215,240,0.20)');
      chrome.addColorStop(0.32, 'rgba(18, 16, 30, 0.55)');
      chrome.addColorStop(0.58, 'rgba(10,  8, 20, 0.40)');
      chrome.addColorStop(0.80, 'rgba(160,155,185,0.38)');
      chrome.addColorStop(1,    'rgba(240,238,255,0.55)');
      ctx.fillStyle = chrome;
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.fill();

      ctx.restore();

      // ── 4. Radial vignette — edge darkening for 3-D convex feel ─────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      const vig = ctx.createRadialGradient(cx, cy - ry * 0.08, 0, cx, cy, Math.max(rx, ry) * 1.08);
      vig.addColorStop(0,    'transparent');
      vig.addColorStop(0.50, 'transparent');
      vig.addColorStop(1,    'rgba(0,0,0,0.62)');
      ctx.fillStyle = vig;
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.fill();
      ctx.restore();

      // ── 5. Primary specular crescent — upper-left ────────────────────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      const hl1x = cx - rx * 0.28, hl1y = cy - ry * 0.48;
      const hl1  = ctx.createRadialGradient(hl1x, hl1y, 0, hl1x, hl1y, rx * 0.50);
      hl1.addColorStop(0,    'rgba(255,255,255,0.90)');
      hl1.addColorStop(0.25, 'rgba(255,255,255,0.35)');
      hl1.addColorStop(0.60, 'rgba(255,255,255,0.06)');
      hl1.addColorStop(1,    'transparent');
      ctx.fillStyle = hl1;
      ctx.beginPath();
      ctx.ellipse(hl1x, hl1y, rx * 0.46, ry * 0.28, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── 6. Secondary micro-highlights — 3 small rim catches ─────────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      [
        [cx + rx * 0.62, cy - ry * 0.22, rx * 0.10, 0.70],
        [cx - rx * 0.55, cy + ry * 0.40, rx * 0.07, 0.45],
        [cx + rx * 0.28, cy + ry * 0.60, rx * 0.06, 0.38],
      ].forEach(([hx, hy, hr, opa]) => {
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        hg.addColorStop(0, `rgba(255,255,255,${opa})`);
        hg.addColorStop(1, 'transparent');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // ── 7. Caustic shimmer — drifting light spots inside ────────────────
      const t0 = elapsed * 0.18;
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      [
        [0.15, 0.22, 0.11, 0.4, 0],
        [-0.18, -0.08, 0.08, 0.28, Math.PI],
      ].forEach(([ox, oy, hr, opa, phase]) => {
        const kx = cx + rx * (ox + 0.06 * Math.cos(t0 + phase));
        const ky = cy + ry * (oy + 0.04 * Math.sin(t0 * 1.3 + phase));
        const kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, rx * hr);
        kg.addColorStop(0, `rgba(220,230,255,${opa})`);
        kg.addColorStop(1, 'transparent');
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.arc(kx, ky, rx * hr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // ── 8. Clock face elements — secondary / subtle ──────────────────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      drawClockFace(ctx, cx, cy, rx, ry, { meltT, alpha: 0.70 });
      ctx.restore();

      // ── 9. Glass rim — thick, inner glow, outer halo ────────────────────
      // Outer halo (glow beyond the shape)
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.28)';
      ctx.shadowBlur  = 14;
      const rim = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      rim.addColorStop(0,   'rgba(255,255,255,0.96)');
      rim.addColorStop(0.18,'rgba(230,228,248,0.82)');
      rim.addColorStop(0.45,'rgba(100, 96,120,0.55)');
      rim.addColorStop(0.72,'rgba(200,198,220,0.78)');
      rim.addColorStop(1,   'rgba(252,250,255,0.92)');
      ctx.strokeStyle = rim;
      ctx.lineWidth   = 4.5;
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.stroke();
      ctx.restore();

      // Inner dark line (creates thickness illusion — glass edge)
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth   = 3;
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.stroke();
      ctx.restore();

      // ── 10. Drip particles ────────────────────────────────────────────────
      const bottomY = cy + ry + ry * 3.2;
      if (elapsed > 0.5 && Math.random() < 0.12) {
        const spread = rx * 0.50 * Math.random();
        const spawnX = cx + rx * 0.30 + (Math.random() < 0.5 ? spread : -spread * 0.4);
        const spawnY = bottomY - Math.random() * ry * 0.3;
        drips.push(makeDrip(spawnX, spawnY));
      }
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        d.trail.push({ x: d.x, y: d.y });
        if (d.trail.length > 12) d.trail.shift();
        d.vy      *= 1.026;
        d.y       += d.vy;
        d.opacity -= 0.007;
        if (d.opacity <= 0 || d.y > H + 40) { drips.splice(i, 1); continue; }
        if (d.trail.length > 1) {
          const tg = ctx.createLinearGradient(d.trail[0].x, d.trail[0].y, d.x, d.y);
          tg.addColorStop(0, 'transparent');
          tg.addColorStop(1, `rgba(210,206,228,${d.opacity * 0.55})`);
          ctx.strokeStyle = tg; ctx.lineWidth = d.r * 0.65; ctx.lineCap = 'round';
          ctx.beginPath();
          d.trail.forEach((p, ti) => ti === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.lineTo(d.x, d.y); ctx.stroke();
        }
        ctx.save();
        ctx.globalAlpha = d.opacity;
        const bg = ctx.createRadialGradient(d.x - d.r*0.32, d.y - d.r*0.32, 0, d.x, d.y, d.r);
        bg.addColorStop(0,   'rgba(255,255,255,0.95)');
        bg.addColorStop(0.40,'rgba(210,206,230,0.85)');
        bg.addColorStop(0.82,'rgba(90, 86,112,0.80)');
        bg.addColorStop(1,   'rgba(30, 26, 45,0.70)');
        ctx.fillStyle = bg;
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ── 11. Proximity edge glow ───────────────────────────────────────────
      if (hd?.index) {
        const fx = hd.index.x * W, fy = hd.index.y * H;
        const distToCenter = Math.hypot(fx - cx, fy - cy);
        const proximity    = Math.max(0, 1 - distToCenter / (rx * 2.2));
        if (proximity > 0.05) {
          const dAngle = Math.atan2(fy - cy, fx - cx);
          const ex     = cx + Math.cos(dAngle) * rx;
          const ey     = cy + Math.sin(dAngle) * ry;
          const eg     = ctx.createRadialGradient(ex, ey, 0, ex, ey, rx * 0.35);
          eg.addColorStop(0, `rgba(255,255,255,${proximity * 0.45})`);
          eg.addColorStop(1, 'transparent');
          ctx.fillStyle = eg;
          ctx.beginPath(); ctx.arc(ex, ey, rx * 0.35, 0, Math.PI * 2); ctx.fill();
        }
      }

      // ── 12. Ripple rings ──────────────────────────────────────────────────
      for (let i = ripples.current.length - 1; i >= 0; i--) {
        const r = ripples.current[i];
        r.t += 0.016;
        const rOpa = Math.max(0, 0.40 - r.t * 0.55);
        if (rOpa <= 0) { ripples.current.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(255,255,255,${rOpa})`;
        ctx.lineWidth   = 1.2;
        ctx.beginPath(); ctx.arc(r.cx, r.cy, r.t * 200, 0, Math.PI * 2); ctx.stroke();
      }

      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [ellipse, videoRef]);

  return (
    <div className="fixed inset-0" style={{ zIndex: 40 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <motion.button
        onClick={onReset}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3, duration: 1.2 }}
        style={{
          position: 'absolute', bottom: 36, right: 44,
          fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
          letterSpacing: '0.38em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none',
          cursor: 'pointer', transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.target.style.color = 'rgba(255,255,255,0.75)')}
        onMouseLeave={(e) => (e.target.style.color = 'rgba(255,255,255,0.28)')}
      >
        Draw Again
      </motion.button>
    </div>
  );
}
