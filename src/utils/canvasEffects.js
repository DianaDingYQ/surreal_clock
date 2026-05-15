/**
 * Canvas drawing primitives.
 * All functions are pure — they take a CanvasRenderingContext2D and draw, nothing else.
 * This module is designed to be replaced with a WebGL/Three.js layer later.
 */

// ── Smooth path rendering ────────────────────────────────────────────────────

/**
 * Draw a smooth Catmull-Rom spline through points with a glowing appearance.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x,y}>} pts  - canvas-space points
 * @param {string} color      - CSS color
 * @param {number} lineWidth
 * @param {number} glowRadius - shadow blur px
 */
export function drawGlowingPath(ctx, pts, color = '#ffffff', lineWidth = 2.5, glowRadius = 18) {
  if (pts.length < 2) return;

  // Outer glow pass (wide, transparent)
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glowRadius * 2;
  ctx.strokeStyle = color.replace(')', ', 0.3)').replace('rgb', 'rgba');
  ctx.lineWidth = lineWidth * 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  traceCatmullRom(ctx, pts);
  ctx.stroke();

  // Core line pass
  ctx.shadowBlur = glowRadius;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  traceCatmullRom(ctx, pts);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw the leading dot at the fingertip position.
 */
export function drawFingertipDot(ctx, x, y, color = '#ffffff') {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  // Inner bright core
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Catmull-Rom spline — smooth curve passing through all control points.
 * Wraps each segment as a cubic Bezier for canvas compatibility.
 */
function traceCatmullRom(ctx, pts, tension = 0.5) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

// ── Film grain ───────────────────────────────────────────────────────────────

/**
 * Fill canvas with random monochrome noise at low opacity.
 * Call every N frames for an animated grain effect.
 */
export function renderNoise(ctx, width, height, opacity = 0.035) {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = (opacity * 255) | 0;
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Melting distortion ───────────────────────────────────────────────────────

/**
 * Apply a wave distortion to a path, increasing with time parameter t ∈ [0,1].
 * Returns a new array of distorted points.
 */
export function distortPath(pts, t, seed = 0) {
  const amp = t * 30; // max displacement in px
  const freq = 0.015;
  return pts.map((p, i) => ({
    x: p.x + Math.sin(p.y * freq + i * 0.3 + seed) * amp * (0.5 + 0.5 * Math.sin(i * 0.7)),
    y: p.y + Math.cos(p.x * freq + i * 0.2 + seed * 1.3) * amp * 0.6,
  }));
}

/**
 * Draw a drip particle — elongated teardrop falling downward.
 */
export function drawDrip(ctx, drip) {
  if (drip.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = drip.opacity;
  ctx.shadowColor = drip.color;
  ctx.shadowBlur = 12;

  // Trail
  if (drip.trail.length > 1) {
    const grad = ctx.createLinearGradient(
      drip.trail[0].x, drip.trail[0].y,
      drip.x, drip.y
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, drip.color);
    ctx.strokeStyle = grad;
    ctx.lineWidth = drip.radius * 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(drip.trail[0].x, drip.trail[0].y);
    drip.trail.forEach((tp) => ctx.lineTo(tp.x, tp.y));
    ctx.lineTo(drip.x, drip.y);
    ctx.stroke();
  }

  // Bead
  ctx.fillStyle = drip.color;
  ctx.beginPath();
  ctx.arc(drip.x, drip.y, drip.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Utility ──────────────────────────────────────────────────────────────────

export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

export function fadeCanvas(ctx, width, height, alpha = 0.15) {
  ctx.save();
  ctx.fillStyle = `rgba(8, 8, 8, ${alpha})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
