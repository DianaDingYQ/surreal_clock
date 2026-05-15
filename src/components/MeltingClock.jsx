/**
 * MeltingClock — the surreal AR reward state.
 *
 * Composition:
 *   Layer 0: Live webcam, softly blurred — the real world stays visible
 *   Layer 1: Floating clock body:
 *              a) Per-pixel convex fisheye interior (person's face reflected + warped)
 *              b) Chrome metallic gradient overlay (sheen without hiding the reflection)
 *              c) Clock face elements in white (ticks, numerals, hands)
 *              d) Specular highlights (bright crescent + rim glow)
 *              e) Outer metallic rim stroke
 *   Layer 2: Drip particles with chrome bead material
 *
 * Fisheye algorithm:
 *   For each pixel (px, py) in the clock face (at FACE_SCALE resolution):
 *     1. Normalise to ellipse space: nx ∈ [-1,1], ny ∈ [-1,1]
 *     2. r = sqrt(nx² + ny²);  skip if r > 1
 *     3. r_src = r^POWER * SPREAD  — maps each output circle to a wider input ring
 *     4. Sample mirrored video at (cx ± r_src*rx, cy ± r_src*ry)
 *   POWER < 1 → centre sees wide area (convex mirror / fisheye effect)
 *   SPREAD > 1 → face captures a bigger chunk of the scene (more of the person visible)
 */

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { traceMeltedClock, drawClockFace } from '../utils/clockGeometry';

// ── Fisheye constants ───────────────────────────────────────────────────────
const FACE_SCALE = 0.45;  // process the clock face at 45% of its canvas size
const SPREAD     = 1.9;   // how many clock-radii wide the captured scene is
const POWER      = 0.52;  // < 1 → fisheye / convex mirror compression
const SAMPLE_SCALE = 0.35; // sample the webcam at 35% for speed

// ── Drip factory ─────────────────────────────────────────────────────────────
function makeDrip(x, y) {
  return { x, y, vy: 0.5 + Math.random() * 0.9, r: 2 + Math.random() * 4.5,
           opacity: 0.85 + Math.random() * 0.15, trail: [] };
}

export default function MeltingClock({ ellipse, videoRef, onReset }) {
  const canvasRef    = useRef(null);
  // Reusable offscreen canvases — created once, reused every frame
  const sampleRef    = useRef(null); // webcam → low-res mirror image
  const faceRef      = useRef(null); // fisheye output for the clock face

  useEffect(() => {
    sampleRef.current = document.createElement('canvas');
    faceRef.current   = document.createElement('canvas');
  }, []);

  useEffect(() => {
    if (!ellipse) return;

    const canvas = canvasRef.current;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const { cx, cy, rx, ry } = ellipse;
    const W = canvas.width, H = canvas.height;

    // Size the offscreen canvases once
    const sampleCanvas = sampleRef.current;
    const faceCanvas   = faceRef.current;

    const sW = Math.ceil(W * SAMPLE_SCALE);
    const sH = Math.ceil(H * SAMPLE_SCALE);
    sampleCanvas.width  = sW;
    sampleCanvas.height = sH;

    const fW = Math.ceil(rx * 2 * FACE_SCALE);
    const fH = Math.ceil(ry * 2 * FACE_SCALE);
    faceCanvas.width  = fW;
    faceCanvas.height = fH;

    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const fCtx = faceCanvas.getContext('2d');

    const drips  = [];
    let   raf;
    const start  = performance.now();

    // ── Per-frame fisheye renderer ────────────────────────────────────────
    function renderFisheye(video) {
      // 1. Sample webcam into sampleCanvas (mirrored, low-res)
      sCtx.save();
      sCtx.scale(-SAMPLE_SCALE, SAMPLE_SCALE);
      sCtx.drawImage(video, -W, 0, W, H);
      sCtx.restore();

      const srcData = sCtx.getImageData(0, 0, sW, sH);
      const dst     = fCtx.createImageData(fW, fH);

      // Clock centre in sample-space (mirrored, so x is flipped)
      const vcx = (W - cx) * SAMPLE_SCALE;
      const vcy = cy       * SAMPLE_SCALE;

      for (let py = 0; py < fH; py++) {
        for (let px = 0; px < fW; px++) {
          // Normalise to ellipse space [-1, 1]
          const nx = (px / fW - 0.5) * 2;
          const ny = (py / fH - 0.5) * 2;
          const r  = Math.hypot(nx, ny);
          if (r > 1.0) continue;

          // Fisheye mapping: r_src = r^POWER * SPREAD
          const rSrc  = Math.pow(r, POWER) * SPREAD;
          const angle = Math.atan2(ny, nx);

          // Map back to sample canvas coordinates
          const sx = Math.max(0, Math.min(sW - 1,
                       Math.round(vcx + Math.cos(angle) * rSrc * rx * SAMPLE_SCALE)));
          const sy = Math.max(0, Math.min(sH - 1,
                       Math.round(vcy + Math.sin(angle) * rSrc * ry * SAMPLE_SCALE)));

          const si = (sy * sW + sx) * 4;
          const di = (py * fW + px) * 4;
          dst.data[di]     = srcData.data[si];
          dst.data[di + 1] = srcData.data[si + 1];
          dst.data[di + 2] = srcData.data[si + 2];
          dst.data[di + 3] = 255;
        }
      }

      fCtx.putImageData(dst, 0, 0);
    }

    // ── Main render loop ───────────────────────────────────────────────────
    function render(now) {
      const elapsed = (now - start) / 1000;
      const meltT   = Math.min(elapsed / 5.5, 1);
      ctx.clearRect(0, 0, W, H);

      // ── 0. Background: real webcam, blurred + slightly darkened ──────────
      const video = videoRef?.current;
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.filter = 'blur(4px) brightness(0.6) saturate(0.75)';
        ctx.scale(-1, 1);
        ctx.drawImage(video, -W, 0, W, H);
        ctx.restore();
      }

      // ── 1a. Compute + upload fisheye image (if video ready) ───────────────
      if (video && video.readyState >= 2) {
        renderFisheye(video);
      }

      // ── 1b. Strong drop shadow for depth ─────────────────────────────────
      ctx.save();
      ctx.shadowColor   = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur    = 55 + meltT * 35;
      ctx.shadowOffsetY = 22 + meltT * 28;
      ctx.fillStyle     = 'rgba(0,0,0,0.01)'; // invisible fill just to cast shadow
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.fill();
      ctx.restore();

      // ── 1c. Fisheye webcam interior ───────────────────────────────────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(faceCanvas, cx - rx, cy - ry, rx * 2, ry * 2);
      ctx.restore();

      // ── 1d. Chrome metallic overlay (keeps webcam visible) ───────────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();

      // Directional chrome sheen: bright upper-left, darker lower-right
      const chromeGrad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.6, cy + ry * 0.6);
      chromeGrad.addColorStop(0,   'rgba(240,238,250,0.22)');
      chromeGrad.addColorStop(0.35,'rgba(180,175,200,0.06)');
      chromeGrad.addColorStop(0.70,'rgba(40, 38, 55, 0.10)');
      chromeGrad.addColorStop(1,   'rgba(160,155,180,0.14)');
      ctx.fillStyle = chromeGrad;
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.fill();

      // Edge darkening vignette (gives depth — feels like a convex 3-D object)
      const vigGrad = ctx.createRadialGradient(cx, cy - ry * 0.05, 0, cx, cy, Math.max(rx, ry) * 1.05);
      vigGrad.addColorStop(0,   'transparent');
      vigGrad.addColorStop(0.55,'transparent');
      vigGrad.addColorStop(1,   'rgba(0,0,0,0.52)');
      ctx.fillStyle = vigGrad;
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.fill();

      ctx.restore();

      // ── 1e. Clock face elements (white ticks, numerals, hands) ───────────
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();
      drawClockFace(ctx, cx, cy, rx, ry, { meltT, alpha: Math.max(0.55, 1 - meltT * 0.35) });
      ctx.restore();

      // ── 1f. Specular highlights (sit on top — simulates convex surface) ──
      ctx.save();
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.clip();

      // Primary highlight: bright crescent upper-left
      const hl1x = cx - rx * 0.22, hl1y = cy - ry * 0.45;
      const hl1  = ctx.createRadialGradient(hl1x, hl1y, 0, hl1x, hl1y, rx * 0.58);
      hl1.addColorStop(0,   'rgba(255,255,255,0.72)');
      hl1.addColorStop(0.30,'rgba(255,255,255,0.22)');
      hl1.addColorStop(0.70,'rgba(255,255,255,0.04)');
      hl1.addColorStop(1,   'transparent');
      ctx.fillStyle = hl1;
      ctx.beginPath();
      ctx.ellipse(hl1x, hl1y, rx * 0.52, ry * 0.32, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Secondary micro-highlight (lower-right edge catch)
      const hl2x = cx + rx * 0.42, hl2y = cy + ry * 0.30;
      const hl2  = ctx.createRadialGradient(hl2x, hl2y, 0, hl2x, hl2y, rx * 0.22);
      hl2.addColorStop(0, 'rgba(255,255,255,0.25)');
      hl2.addColorStop(1, 'transparent');
      ctx.fillStyle = hl2;
      ctx.beginPath();
      ctx.arc(hl2x, hl2y, rx * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ── 1g. Rim: metallic gradient stroke ────────────────────────────────
      ctx.save();
      const rimGrad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      rimGrad.addColorStop(0,   'rgba(255,255,255,0.95)');
      rimGrad.addColorStop(0.20,'rgba(210,208,230,0.80)');
      rimGrad.addColorStop(0.50,'rgba(130,125,150,0.60)');
      rimGrad.addColorStop(0.80,'rgba(200,195,220,0.75)');
      rimGrad.addColorStop(1,   'rgba(250,248,255,0.90)');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth   = 3.5;
      ctx.shadowColor = 'rgba(255,255,255,0.40)';
      ctx.shadowBlur  = 10;
      traceMeltedClock(ctx, cx, cy, rx, ry, meltT);
      ctx.stroke();
      ctx.restore();

      // ── 2. Drip particles ─────────────────────────────────────────────────
      if (elapsed > 1.2 && meltT > 0.18 && Math.random() < 0.14 + meltT * 0.10) {
        const spread = rx * 0.55 * Math.random();
        const spawnX = cx + (Math.random() < 0.5 ? spread : -spread) * (0.3 + Math.random() * 0.7);
        const spawnY = cy + ry + meltT * ry * 3.6 - Math.random() * ry * 0.2;
        drips.push(makeDrip(spawnX, spawnY));
      }

      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        d.trail.push({ x: d.x, y: d.y });
        if (d.trail.length > 16) d.trail.shift();
        d.vy     *= 1.024;
        d.y      += d.vy;
        d.opacity -= 0.006;
        if (d.opacity <= 0 || d.y > H + 50) { drips.splice(i, 1); continue; }

        // Metallic trail
        if (d.trail.length > 1) {
          const tGrad = ctx.createLinearGradient(d.trail[0].x, d.trail[0].y, d.x, d.y);
          tGrad.addColorStop(0, 'transparent');
          tGrad.addColorStop(1, `rgba(200,196,220,${d.opacity * 0.65})`);
          ctx.strokeStyle = tGrad;
          ctx.lineWidth   = d.r * 0.75;
          ctx.lineCap     = 'round';
          ctx.beginPath();
          d.trail.forEach((p, ti) => ti === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }

        // Chrome bead: radial gradient to fake 3-D sphere
        ctx.save();
        ctx.globalAlpha = d.opacity;
        const bg = ctx.createRadialGradient(d.x - d.r * 0.35, d.y - d.r * 0.35, 0, d.x, d.y, d.r);
        bg.addColorStop(0,   'rgba(255,255,255,0.95)');
        bg.addColorStop(0.40,'rgba(210,205,230,0.85)');
        bg.addColorStop(0.80,'rgba(100, 96,120,0.80)');
        bg.addColorStop(1,   'rgba( 40, 36, 55,0.70)');
        ctx.fillStyle   = bg;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [ellipse, videoRef]);

  return (
    <div className="fixed inset-0" style={{ zIndex: 40 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* "Draw Again" appears after 8s, white text on dark bg */}
      <motion.button
        onClick={onReset}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 8, duration: 1.5 }}
        style={{
          position: 'absolute', bottom: 36, right: 44,
          fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
          letterSpacing: '0.38em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.32)', background: 'none', border: 'none',
          cursor: 'pointer', transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.target.style.color = 'rgba(255,255,255,0.80)')}
        onMouseLeave={(e) => (e.target.style.color = 'rgba(255,255,255,0.32)')}
      >
        Draw Again
      </motion.button>
    </div>
  );
}
