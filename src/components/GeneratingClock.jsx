/**
 * GeneratingClock — 5-second formation animation.
 *
 * Timeline (seconds):
 *  0.0 – 0.5   raw path gathers inward and fades
 *  0.3 – 1.2   organic silhouette traces itself in (dashed stroke)
 *  1.2 – 2.0   dark body + chrome gradient materialise
 *  2.0 – 2.7   rim stroke and specular highlights
 *  2.6 – 3.5   clock face ticks + numerals fade in
 *  3.3 – 4.2   hands appear
 *  4.0 – 5.0   fisheye webcam interior fades in (with chromatic aberration)
 *  5.0         calls onComplete()
 */

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { traceMeltedClock, drawClockFace } from '../utils/clockGeometry';

const FACE_SCALE   = 0.50;
const SPREAD       = 2.0;
const POWER        = 0.38;
const SAMPLE_SCALE = 0.35;
const CA           = 0.028;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v)     { return Math.max(0, Math.min(1, v)); }
function ramp(e, s, en) { return clamp01((e - s) / (en - s)); }

export default function GeneratingClock({ ellipse, rawPath, videoRef, onComplete }) {
  const canvasRef = useRef(null);
  const sampleRef = useRef(null);
  const faceRef   = useRef(null);

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
    const { cx, cy, rx, ry } = ellipse;
    const W = canvas.width, H = canvas.height;

    const sampleCanvas = sampleRef.current;
    const faceCanvas   = faceRef.current;
    const sW = Math.ceil(W * SAMPLE_SCALE), sH = Math.ceil(H * SAMPLE_SCALE);
    sampleCanvas.width  = sW; sampleCanvas.height = sH;
    faceCanvas.width    = Math.ceil(rx * 2 * FACE_SCALE);
    faceCanvas.height   = Math.ceil(ry * 2 * FACE_SCALE);
    const fW = faceCanvas.width, fH = faceCanvas.height;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const fCtx = faceCanvas.getContext('2d');

    function renderFisheye(video) {
      sCtx.save();
      sCtx.scale(-SAMPLE_SCALE, SAMPLE_SCALE);
      sCtx.drawImage(video, -W, 0, W, H);
      sCtx.restore();
      const src = sCtx.getImageData(0, 0, sW, sH);
      const dst = fCtx.createImageData(fW, fH);
      const vcx = (W - cx) * SAMPLE_SCALE, vcy = cy * SAMPLE_SCALE;
      for (let py = 0; py < fH; py++) {
        for (let px = 0; px < fW; px++) {
          const nx = (px / fW - 0.5) * 2;
          const ny = (py / fH - 0.5) * 2;
          const r  = Math.hypot(nx, ny);
          if (r > 1.0) continue;
          const angle = Math.atan2(ny, nx);
          const rSrc  = Math.pow(r, POWER) * SPREAD;
          function sample(rs, ch) {
            const sx = Math.max(0, Math.min(sW-1, Math.round(vcx + Math.cos(angle)*rs*rx*SAMPLE_SCALE)));
            const sy = Math.max(0, Math.min(sH-1, Math.round(vcy + Math.sin(angle)*rs*ry*SAMPLE_SCALE)));
            return src.data[(sy*sW+sx)*4+ch];
          }
          const di = (py*fW+px)*4;
          dst.data[di]   = sample(rSrc*(1-CA*r), 0);
          dst.data[di+1] = sample(rSrc,           1);
          dst.data[di+2] = sample(rSrc*(1+CA*r), 2);
          dst.data[di+3] = 255;
        }
      }
      fCtx.putImageData(dst, 0, 0);
    }

    const start = performance.now();
    // Approximate perimeter for dash animation
    const perim = Math.PI * (3*(rx+ry) - Math.sqrt((3*rx+ry)*(rx+3*ry)));
    let raf;
    let completed = false;

    function render(now) {
      const e = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Webcam background
      const video = videoRef?.current;
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.filter = 'blur(5px) brightness(0.55) saturate(0.70)';
        ctx.scale(-1, 1);
        ctx.drawImage(video, -W, 0, W, H);
        ctx.restore();
      }

      // 1. Raw path gathers inward
      const gT = ramp(e, 0, 0.55);
      if (rawPath && rawPath.length >= 2 && gT < 1) {
        ctx.save();
        ctx.globalAlpha = (1 - gT) * 0.65;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth   = 1.2;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        rawPath.forEach((p, i) => {
          const lx = lerp(p.x, cx, gT), ly = lerp(p.y, cy, gT);
          i === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
        });
        ctx.stroke();
        ctx.restore();
      }

      // 2. Silhouette traces in (dashed stroke, organic shape)
      const trT = ramp(e, 0.3, 1.2);
      if (trT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, trT * 2.5);
        ctx.strokeStyle = 'rgba(255,255,255,0.70)';
        ctx.lineWidth   = 1.2;
        ctx.setLineDash([perim * trT, perim]);
        ctx.lineDashOffset = -(perim * (1 - trT));
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 3. Dark body + chrome materialise
      const bT = ramp(e, 1.2, 2.0);
      if (bT > 0) {
        ctx.save();
        ctx.globalAlpha = bT;
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.clip();
        ctx.fillStyle = 'rgba(18,16,28,0.82)';
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.fill();
        const chrome = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
        chrome.addColorStop(0,    'rgba(255,255,255,0.45)');
        chrome.addColorStop(0.12, 'rgba(210,206,230,0.18)');
        chrome.addColorStop(0.35, 'rgba(18, 16, 30, 0.52)');
        chrome.addColorStop(0.65, 'rgba(155,150,178,0.35)');
        chrome.addColorStop(1,    'rgba(240,238,255,0.52)');
        ctx.fillStyle = chrome;
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.fill();
        // Vignette
        const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx,ry)*1.05);
        vig.addColorStop(0.5, 'transparent');
        vig.addColorStop(1,   'rgba(0,0,0,0.55)');
        ctx.fillStyle = vig;
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.fill();
        ctx.restore();
      }

      // 4. Specular + rim
      const sT = ramp(e, 2.0, 2.7);
      if (sT > 0) {
        ctx.save();
        ctx.globalAlpha = sT;
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.clip();
        const hl1x = cx - rx*0.28, hl1y = cy - ry*0.48;
        const hl1  = ctx.createRadialGradient(hl1x, hl1y, 0, hl1x, hl1y, rx*0.50);
        hl1.addColorStop(0, 'rgba(255,255,255,0.88)');
        hl1.addColorStop(0.28, 'rgba(255,255,255,0.30)');
        hl1.addColorStop(1, 'transparent');
        ctx.fillStyle = hl1;
        ctx.beginPath(); ctx.ellipse(hl1x, hl1y, rx*0.46, ry*0.28, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // Rim
        ctx.save();
        ctx.globalAlpha = sT;
        ctx.shadowColor = 'rgba(255,255,255,0.22)';
        ctx.shadowBlur  = 12;
        const rim = ctx.createLinearGradient(cx-rx, cy-ry, cx+rx, cy+ry);
        rim.addColorStop(0,   'rgba(255,255,255,0.95)');
        rim.addColorStop(0.45,'rgba(100, 96,120,0.52)');
        rim.addColorStop(1,   'rgba(250,248,255,0.90)');
        ctx.strokeStyle = rim; ctx.lineWidth = 4;
        traceMeltedClock(ctx, cx, cy, rx, ry, 0); ctx.stroke();
        ctx.restore();
      }

      // 5. Clock face
      const fT = ramp(e, 2.6, 3.5);
      if (fT > 0) {
        ctx.save();
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.clip();
        drawClockFace(ctx, cx, cy, rx, ry, { meltT: 0, alpha: fT * 0.72 });
        ctx.restore();
      }

      // 6. Fisheye interior fades in
      const fishT = ramp(e, 4.0, 5.0);
      if (fishT > 0 && video && video.readyState >= 2) {
        renderFisheye(video);
        ctx.save();
        ctx.globalAlpha = fishT;
        traceMeltedClock(ctx, cx, cy, rx, ry, 0);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(faceCanvas, cx - rx, cy - ry, rx*2, ry*2);
        ctx.restore();
      }

      if (e >= 5.0 && !completed) {
        completed = true;
        onComplete();
      }

      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [ellipse, rawPath, videoRef, onComplete]);

  if (!ellipse) return null;

  return (
    <motion.div
      className="fixed inset-0"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ zIndex: 35 }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </motion.div>
  );
}
