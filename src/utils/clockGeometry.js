/**
 * clockGeometry.js
 *
 * Organic Catmull-Rom silhouette — NOT a bezier ellipse.
 * At meltT=0: compact irregular oval (like a mercury droplet).
 * At meltT=1: asymmetric drip — main drip at ~4-o'clock, secondary at ~7-o'clock.
 *
 * Size: 8.5% of the short screen dimension → jewel-scale, not a UI container.
 */

// ── Ellipse fitting ──────────────────────────────────────────────────────────

export function fitEllipseToPath(pts, W, H) {
  const base = Math.min(W, H);
  const rx   = base * 0.085;  // jewel-scale — about 10% of frame width
  const ry   = rx  * 0.88;   // nearly circular, like a pocket watch

  if (!pts || pts.length < 4) return { cx: W / 2, cy: H * 0.42, rx, ry };

  const trim = Math.max(1, Math.floor(pts.length * 0.05));
  const xs   = pts.map((p) => p.x).sort((a, b) => a - b).slice(trim, -trim);
  const ys   = pts.map((p) => p.y).sort((a, b) => a - b).slice(trim, -trim);
  const cx   = (xs[0] + xs[xs.length - 1]) / 2;
  const cy   = (ys[0] + ys[ys.length - 1]) / 2;

  const margin = 0.08;
  const clampedCx = Math.max(rx + W * margin, Math.min(W - rx - W * margin, cx));
  const clampedCy = Math.max(ry + H * margin, Math.min(H - ry - H * margin, cy));
  return { cx: clampedCx, cy: clampedCy, rx, ry };
}

// ── Organic silhouette ───────────────────────────────────────────────────────

/**
 * Trace an organic melting clock silhouette onto ctx.
 * Uses 80 Catmull-Rom control points for a smooth, sculptural outline.
 *
 * θ = 0 → right (+x), π/2 → bottom (+y screen), π → left, 3π/2 → top
 *
 * At meltT=0: slightly irregular oval (right side subtly larger, gentle S-twist).
 * At meltT=1: right drip at ~60°, secondary drip at ~150°.
 *
 * Returns bottomY (lowest point) for drip particle spawning.
 */
export function traceMeltedClock(ctx, cx, cy, rx, ry, meltT) {
  const N   = 80;
  const pts = [];

  for (let i = 0; i < N; i++) {
    const t     = i / N;
    const theta = t * Math.PI * 2;

    // Slightly irregular base (not a perfect ellipse)
    const rxL = rx * (1.0 + 0.055 * Math.cos(theta) - 0.018 * Math.cos(2 * theta));
    const ryL = ry * (1.0 - 0.022 * Math.sin(2 * theta));

    let bx = cx + Math.cos(theta) * rxL;
    let by = cy + Math.sin(theta) * ryL;

    if (meltT > 0) {
      // Right drip — peaks at 4-o'clock direction (θ ≈ π/3 = 60°)
      const rdc  = Math.PI / 3;
      let da     = theta - rdc;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const rFocus = Math.exp(-da * da * 5.5) * Math.max(0, Math.sin(theta));

      // Secondary drip — at 7:30 direction (θ ≈ 5π/6 = 150°)
      const ldc  = Math.PI * 0.83;
      let daL    = theta - ldc;
      while (daL >  Math.PI) daL -= Math.PI * 2;
      while (daL < -Math.PI) daL += Math.PI * 2;
      const lFocus = Math.exp(-daL * daL * 7.5) * Math.max(0, Math.sin(theta));

      by += ry * 3.2 * meltT * rFocus;     // right drip drops far
      bx += rx * 0.14 * meltT * rFocus;    // slight rightward lean
      by += ry * 1.55 * meltT * lFocus;    // secondary drip shorter
      bx -= rx * 0.07 * meltT * lFocus;    // slight leftward lean
    }

    pts.push({ x: bx, y: by });
  }

  // Catmull-Rom through all N points (closed)
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y
    );
  }
  ctx.closePath();

  return Math.max(...pts.map((p) => p.y));
}

// ── Clock face decorations ───────────────────────────────────────────────────

/**
 * Ticks, Roman numerals, hands — secondary to the material.
 * All elements white/light on dark/webcam background.
 * alpha param controls the overall opacity (used for fade-in during generation).
 */
export function drawClockFace(ctx, cx, cy, rx, ry, { meltT = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.82; // face is intentionally subtle vs material

  const R = Math.min(rx, ry);

  // Tick marks
  for (let h = 0; h < 12; h++) {
    const angle = (h / 12) * Math.PI * 2 - Math.PI / 2;
    const major = h % 3 === 0;
    const len   = major ? R * 0.13 : R * 0.07;
    const rO    = R * 0.85;
    const rI    = rO - len;
    const sag   = meltT * Math.max(0, Math.sin(angle + Math.PI / 2)) * ry * 0.5;

    ctx.strokeStyle = major ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth   = major ? 1.8 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * rO, cy + Math.sin(angle) * rO * (ry / rx) + sag);
    ctx.lineTo(cx + Math.cos(angle) * rI, cy + Math.sin(angle) * rI * (ry / rx) + sag * 0.8);
    ctx.stroke();
  }

  // Roman numerals at quarter positions
  const fontSize = Math.round(R * 0.17);
  ctx.font        = `300 ${fontSize}px "Cormorant Garamond", serif`;
  ctx.fillStyle   = 'rgba(255,255,255,0.88)';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur  = 5;

  [['XII', -Math.PI / 2], ['III', 0], ['VI', Math.PI / 2], ['IX', Math.PI]].forEach(
    ([label, angle]) => {
      const nr  = R * 0.64;
      const sag = meltT * Math.max(0, Math.sin(angle + Math.PI / 2)) * ry * 0.60;
      ctx.fillText(label, cx + Math.cos(angle) * nr, cy + Math.sin(angle) * nr * (ry / rx) + sag);
    }
  );
  ctx.shadowBlur = 0;

  // Hands
  ctx.shadowColor = 'rgba(0,0,0,0.50)';
  ctx.shadowBlur  = 6;
  drawHand(ctx, cx, cy, rx, ry, (-60 * Math.PI) / 180, 0.50, 3.0, meltT);
  drawHand(ctx, cx, cy, rx, ry, ( 60 * Math.PI) / 180, 0.70, 1.8, meltT);

  // Centre hub
  ctx.shadowBlur = 10;
  const hub = ctx.createRadialGradient(cx - 1.5, cy - 1.5, 0, cx, cy, 6);
  hub.addColorStop(0, 'rgba(255,255,255,1)');
  hub.addColorStop(1, 'rgba(190,186,210,0.8)');
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHand(ctx, cx, cy, rx, ry, angle, lengthFactor, lw, meltT) {
  const len = Math.min(rx, ry) * lengthFactor;
  const ex  = cx + Math.cos(angle) * len;
  const ey  = cy + Math.sin(angle) * len;
  const sag = len * 0.28 * meltT + Math.max(0, Math.sin(angle + Math.PI / 2)) * meltT * ry * 0.28;
  const mx  = (cx + ex) / 2 - Math.sin(angle) * len * 0.04;
  const my  = (cy + ey) / 2 + sag;

  ctx.lineWidth   = lw;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.fillStyle   = 'rgba(255,255,255,0.92)';
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  if (meltT > 0.1) {
    const dr = lw * (0.85 + meltT);
    ctx.beginPath();
    ctx.arc(ex, ey + dr * meltT * 1.5, dr, 0, Math.PI * 2);
    ctx.fill();
  }
}
