/**
 * DaliClock
 *
 * The centrepiece reveal. Takes the user's closed drawn path and renders:
 *
 *  1. Frosted-glass interior  — the shape is used as a canvas clip mask;
 *     inside, the live webcam feed is drawn blurred + desaturated + tinted,
 *     then overlaid with a translucent white "glass" layer.
 *
 *  2. Melting outline  — the path outline is animated with a time-varying
 *     sinusoidal displacement on each vertex, creating a liquid warp.
 *     Gravity bias pulls the bottom of the shape downward.
 *
 *  3. Dalí clock hands — two drooping bezier hands from the centroid,
 *     sag amplitude increases over time then stabilises.
 *
 *  4. Drip particles — spawned from the lowest points of the outline,
 *     fall with acceleration and fade out.
 *
 *  5. Outer background — white, so the shape reads as a frosted window.
 */

import { useEffect, useRef } from 'react';

// ── Geometry helpers ─────────────────────────────────────────────────────────

function centroid(pts) {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function boundingBox(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

// Downsample path for distortion (uses a subset of points for performance)
function downsample(pts, n) {
  if (pts.length <= n) return pts;
  const step = (pts.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => pts[Math.round(i * step)]);
}

// Catmull-Rom spline trace
function traceCR(ctx, pts, close = false) {
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
  if (close) ctx.closePath();
}

// Apply wave-gravity distortion to path (returns new point array)
function distortOutline(pts, t, bb) {
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const h = bb.maxY - bb.minY;

  return pts.map((p, i) => {
    const angle = (i / pts.length) * Math.PI * 2;
    // Multi-frequency wave
    const waveX = Math.sin(angle * 4 + t * 0.9) * 5 + Math.sin(angle * 9 + t * 1.7) * 2.5;
    const waveY = Math.cos(angle * 3 + t * 0.7) * 5 + Math.cos(angle * 7 + t * 1.3) * 2.5;
    // Gravity: bottom of shape droops more
    const normY = (p.y - cy) / (h / 2 + 0.001); // -1 (top) … +1 (bottom)
    const droop = Math.max(0, normY) * 18 * Math.sin(t * 0.25 + 0.5);

    return { x: p.x + waveX, y: p.y + waveY + droop };
  });
}

// ── Drip particle factory ────────────────────────────────────────────────────

function spawnDrip(pts, bb) {
  // Spawn from the bottom quarter of the shape
  const bottomPts = pts.filter((p) => p.y > bb.minY + (bb.maxY - bb.minY) * 0.6);
  const origin = bottomPts.length
    ? bottomPts[Math.floor(Math.random() * bottomPts.length)]
    : pts[Math.floor(Math.random() * pts.length)];

  return {
    x: origin.x + (Math.random() - 0.5) * 10,
    y: origin.y,
    vy: 0.4 + Math.random() * 0.8,
    r: 2 + Math.random() * 4,
    opacity: 0.7 + Math.random() * 0.3,
    trail: [],
  };
}

// ── Melting clock hand ───────────────────────────────────────────────────────

function drawMeltingHand(ctx, cx, cy, angleDeg, lengthFactor, bb, sagT) {
  const rad = (angleDeg * Math.PI) / 180;
  const size = Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.5 * lengthFactor;
  const ex = cx + Math.cos(rad) * size;
  const ey = cy + Math.sin(rad) * size;
  // Control point: mid-point + downward sag
  const mx = (cx + ex) / 2 - Math.sin(rad) * size * 0.08;
  const my = (cy + ey) / 2 + size * 0.3 * sagT;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // Small teardrop at tip
  ctx.beginPath();
  ctx.arc(ex + Math.cos(rad) * 3, ey + size * 0.04 * sagT, ctx.lineWidth * 1.4, 0, Math.PI * 2);
  ctx.fill();
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DaliClock({ closedPath, videoRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!closedPath?.length) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const bb = boundingBox(closedPath);
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;

    // Use fewer points for distortion loop (performance)
    const basePts = downsample(closedPath, 120);

    const drips = [];
    let raf;
    let t = 0;
    const startTime = performance.now();

    function render() {
      const elapsed = (performance.now() - startTime) / 1000;
      t = elapsed;
      const W = canvas.width;
      const H = canvas.height;

      // Sag increases over first 3s, then stabilises
      const sagT = Math.min(elapsed / 3, 1);

      // White background
      ctx.fillStyle = '#f5f5f3';
      ctx.fillRect(0, 0, W, H);

      // ── 1. Distorted outline shape (clip + fill) ─────────────────────────
      const distorted = distortOutline(basePts, t, bb);

      // ── 1a. Frosted glass interior ───────────────────────────────────────
      ctx.save();
      traceCR(ctx, distorted, true);
      ctx.clip();

      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        // Draw webcam blurred + desaturated inside the clip
        ctx.filter = 'blur(14px) saturate(0.08) brightness(1.35)';
        ctx.save();
        ctx.scale(-1, 1); // mirror for selfie
        ctx.drawImage(video, -W, 0, W, H);
        ctx.restore();
        ctx.filter = 'none';
      }

      // Frosted white glass overlay (semi-transparent)
      ctx.fillStyle = 'rgba(245, 245, 243, 0.52)';
      traceCR(ctx, distorted, true);
      ctx.fill();

      // Subtle inner vignette — darker at edges of the glass shape
      const cx2 = (bb.minX + bb.maxX) / 2;
      const cy2 = (bb.minY + bb.maxY) / 2;
      const r = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.6;
      const vig = ctx.createRadialGradient(cx2, cy2, r * 0.3, cx2, cy2, r);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(180,175,210,0.25)');
      ctx.fillStyle = vig;
      traceCR(ctx, distorted, true);
      ctx.fill();

      ctx.restore();

      // ── 1b. Clock tick marks inside the shape ────────────────────────────
      ctx.save();
      traceCR(ctx, distorted, true);
      ctx.clip();
      const innerR = Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.42;
      for (let h = 0; h < 12; h++) {
        const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
        const isHour = h % 3 === 0;
        const len = isHour ? 14 : 8;
        const x1 = cx + Math.cos(a) * (innerR - len);
        const y1 = cy + Math.sin(a) * (innerR - len);
        const x2 = cx + Math.cos(a) * innerR;
        const y2 = cy + Math.sin(a) * innerR;
        ctx.strokeStyle = isHour ? 'rgba(60,50,90,0.5)' : 'rgba(60,50,90,0.25)';
        ctx.lineWidth = isHour ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // ── 1c. Melting clock hands ──────────────────────────────────────────
      ctx.save();
      traceCR(ctx, distorted, true);
      ctx.clip();

      ctx.strokeStyle = 'rgba(40, 32, 70, 0.75)';
      ctx.fillStyle = 'rgba(40, 32, 70, 0.75)';
      ctx.lineCap = 'round';

      // Hour hand (pointing ~10 o'clock = -60°)
      ctx.lineWidth = 4;
      drawMeltingHand(ctx, cx, cy, -60 + Math.sin(t * 0.08) * 3, 0.48, bb, sagT);

      // Minute hand (pointing ~2 o'clock = 60°)
      ctx.lineWidth = 2.5;
      drawMeltingHand(ctx, cx, cy, 60 + Math.cos(t * 0.06) * 2, 0.7, bb, sagT);

      // Second hand — thin, barely visible, slow oscillation
      ctx.strokeStyle = 'rgba(160,80,80,0.5)';
      ctx.fillStyle = 'rgba(160,80,80,0.5)';
      ctx.lineWidth = 1;
      drawMeltingHand(ctx, cx, cy, -90 + t * 4, 0.8, bb, sagT * 0.3);

      // Centre hub
      ctx.fillStyle = 'rgba(40, 32, 70, 0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ── 2. Outline stroke (melting, on top of clip) ──────────────────────
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 18, 30, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(80,60,160,0.3)';
      ctx.shadowBlur = 12;
      traceCR(ctx, distorted, true);
      ctx.stroke();
      ctx.restore();

      // ── 3. Drip particles ────────────────────────────────────────────────
      if (elapsed > 0.5 && Math.random() < 0.18 + sagT * 0.15) {
        drips.push(spawnDrip(distorted, bb));
      }

      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        d.trail.push({ x: d.x, y: d.y });
        if (d.trail.length > 20) d.trail.shift();
        d.vy *= 1.022;
        d.y += d.vy;
        d.opacity -= 0.006;

        if (d.opacity <= 0 || d.y > H + 40) { drips.splice(i, 1); continue; }

        // Trail
        ctx.save();
        ctx.globalAlpha = d.opacity * 0.5;
        ctx.strokeStyle = 'rgba(15,18,30,0.8)';
        ctx.lineWidth = d.r * 0.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        d.trail.forEach((tp, ti) => {
          ctx.globalAlpha = d.opacity * (ti / d.trail.length) * 0.4;
          ti === 0 ? ctx.moveTo(tp.x, tp.y) : ctx.lineTo(tp.x, tp.y);
        });
        ctx.stroke();
        ctx.restore();

        // Bead
        ctx.save();
        ctx.globalAlpha = d.opacity;
        ctx.fillStyle = 'rgba(15,18,30,0.85)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(raf);
  }, [closedPath, videoRef]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 20 }} />;
}
