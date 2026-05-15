/**
 * Canvas-based generative art renderer.
 * Produces an atmospheric, surreal visual as a placeholder for actual AI generation.
 * Designed to be swapped out when a real image URL is available.
 *
 * Future upgrade path: if generateImage() returns a URL, draw it to canvas with
 * ctx.drawImage() instead — all the animation scaffolding stays the same.
 */

// Color palettes per shape — deep, atmospheric
const PALETTES = {
  circle: ['#1a0533', '#3d1a6e', '#6b35c4', '#b06fe3', '#e8c4ff', '#ffe8a0'],
  square: ['#001a33', '#003366', '#1a5c99', '#4d9fcc', '#a3d4f0', '#ffffff'],
  triangle: ['#1a1a00', '#4d3300', '#996600', '#cc9900', '#ffcc33', '#fff5b0'],
  blob: ['#001a0d', '#003319', '#006633', '#00994d', '#33cc80', '#b3ffe0'],
};

/**
 * Start rendering generative art onto a canvas element.
 * Returns a cleanup function to stop the animation loop.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} shape - circle | square | triangle | blob
 * @returns {() => void} cleanup
 */
export function startGenerativeArt(canvas, shape) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const palette = PALETTES[shape] ?? PALETTES.blob;
  let raf;
  let t = 0;

  // ── Build scene objects ──────────────────────────────────────────────────

  // Layered organic blobs
  const blobs = Array.from({ length: 14 }, (_, i) => ({
    x: W * (0.15 + Math.random() * 0.7),
    y: H * (0.1 + Math.random() * 0.8),
    baseR: 60 + Math.random() * Math.min(W, H) * 0.22,
    color: palette[Math.floor(Math.random() * palette.length)],
    phase: Math.random() * Math.PI * 2,
    speed: 0.003 + Math.random() * 0.006,
    petals: 3 + Math.floor(Math.random() * 5),
    opacity: 0.06 + Math.random() * 0.18,
  }));

  // Drip streams falling downward
  const drips = Array.from({ length: 18 }, (_, i) => ({
    x: W * (0.1 + (i / 18) * 0.8) + (Math.random() - 0.5) * 60,
    y: H * (0.2 + Math.random() * 0.5),
    speed: 0.4 + Math.random() * 1.2,
    length: 40 + Math.random() * 120,
    width: 1.5 + Math.random() * 4,
    color: palette[Math.floor(Math.random() * palette.length)],
    opacity: 0.3 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    wobble: (Math.random() - 0.5) * 0.8,
  }));

  // Floating light particles
  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.1 - Math.random() * 0.4,
    r: 1 + Math.random() * 3,
    color: palette[Math.floor(Math.random() * palette.length)],
    opacity: 0.4 + Math.random() * 0.6,
    life: Math.random(),
    maxLife: 0.3 + Math.random() * 0.5,
  }));

  // ── Render loop ──────────────────────────────────────────────────────────

  function render() {
    t += 0.016;

    // Dark fade — creates motion blur / smear effect
    ctx.fillStyle = 'rgba(8, 8, 8, 0.12)';
    ctx.fillRect(0, 0, W, H);

    // Background gradient (slow drift)
    const bgGrad = ctx.createRadialGradient(
      W * (0.5 + 0.1 * Math.sin(t * 0.2)),
      H * (0.4 + 0.1 * Math.cos(t * 0.15)),
      0,
      W * 0.5, H * 0.5,
      Math.max(W, H) * 0.7
    );
    bgGrad.addColorStop(0, palette[2] + '22');
    bgGrad.addColorStop(0.5, palette[1] + '11');
    bgGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Organic blobs
    blobs.forEach((b) => {
      ctx.save();
      ctx.globalAlpha = b.opacity * (0.7 + 0.3 * Math.sin(t * b.speed * 3 + b.phase));
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 40;

      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.baseR);
      grad.addColorStop(0, b.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;

      // Polar rose petal shape
      ctx.beginPath();
      const steps = 80;
      for (let s = 0; s <= steps; s++) {
        const theta = (s / steps) * Math.PI * 2;
        const petal = Math.abs(Math.cos(b.petals * theta * 0.5 + t * b.speed + b.phase));
        const r = b.baseR * (0.5 + 0.5 * petal) * (1 + 0.08 * Math.sin(theta * 7 + t * 1.2));
        const px = b.x + r * Math.cos(theta);
        const py = b.y + r * Math.sin(theta) * (1 + 0.3 * Math.sin(t * 0.3)); // vertical melt
        s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Drip streams
    drips.forEach((d) => {
      ctx.save();
      ctx.globalAlpha = d.opacity * (0.5 + 0.5 * Math.sin(t * 0.8 + d.phase));

      const dripY = d.y + Math.sin(t * 0.5 + d.phase) * 20;
      const dripLength = d.length * (0.5 + 0.5 * Math.sin(t * d.speed * 0.5 + d.phase));
      const wobbleX = d.x + Math.sin(t * 1.5 + d.phase) * d.wobble * 15;

      const grad = ctx.createLinearGradient(wobbleX, dripY, wobbleX, dripY + dripLength);
      grad.addColorStop(0, d.color);
      grad.addColorStop(0.7, d.color + '88');
      grad.addColorStop(1, 'transparent');

      ctx.strokeStyle = grad;
      ctx.lineWidth = d.width * (1 + 0.3 * Math.sin(t * 2 + d.phase));
      ctx.lineCap = 'round';
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(wobbleX, dripY);
      ctx.bezierCurveTo(
        wobbleX + 5 * Math.sin(t), dripY + dripLength * 0.33,
        wobbleX - 5 * Math.cos(t), dripY + dripLength * 0.66,
        wobbleX, dripY + dripLength
      );
      ctx.stroke();

      // Drip bead at bottom
      ctx.fillStyle = d.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(wobbleX, dripY + dripLength, d.width * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Floating particles
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life += 0.004;

      if (p.y < -10 || p.life > p.maxLife) {
        p.x = Math.random() * W;
        p.y = H + 10;
        p.life = 0;
      }

      const fade = Math.sin((p.life / p.maxLife) * Math.PI);
      ctx.save();
      ctx.globalAlpha = p.opacity * fade;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Scanline vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    raf = requestAnimationFrame(render);
  }

  render();
  return () => cancelAnimationFrame(raf);
}
