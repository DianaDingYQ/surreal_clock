/**
 * Geometric shape classification using lightweight heuristics.
 * No ML — pure math on the normalized point path [{x, y}] where x,y ∈ [0,1].
 *
 * Pipeline:
 *   1. Downsample path to a fixed-size array to normalize point density
 *   2. Compute circularity (radius variance from centroid)
 *   3. Count sharp corners via angle change
 *   4. Classify based on thresholds
 */

export function analyzeShape(points) {
  if (!points || points.length < 8) return 'blob';

  const sampled = downsample(points, Math.min(points.length, 80));
  const centroid = getCentroid(sampled);
  const bbox = getBoundingBox(sampled);

  // Radial distances from centroid
  const radii = sampled.map((p) => euclidean(p, centroid));
  const meanR = mean(radii);
  const radiusCV = meanR > 0 ? stddev(radii) / meanR : 1; // low CV → circle

  // Closedness: ratio of gap between endpoints to mean radius
  const closedness =
    meanR > 0
      ? euclidean(sampled[0], sampled[sampled.length - 1]) / meanR
      : 1;

  // Bounding-box aspect ratio (h/w)
  const aspect = bbox.w > 0.01 ? bbox.h / bbox.w : 1;

  // Count corners: consecutive segments whose turning angle exceeds threshold
  const corners = countCorners(sampled, 115);

  // ── CIRCLE ──────────────────────────────────────────────────────────────
  // Low radius variance (consistent distance from center) + closed path
  if (radiusCV < 0.25 && closedness < 1.2 && sampled.length > 20) {
    return 'circle';
  }

  // ── TRIANGLE ────────────────────────────────────────────────────────────
  // Exactly 2-3 sharp corners
  if (corners >= 2 && corners <= 3) {
    return 'triangle';
  }

  // ── SQUARE / RECTANGLE ──────────────────────────────────────────────────
  // 4-6 corners, roughly square aspect
  if (corners >= 3 && corners <= 7 && aspect > 0.4 && aspect < 2.5) {
    return 'square';
  }

  return 'blob';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function countCorners(pts, thresholdDeg) {
  const thresh = (thresholdDeg * Math.PI) / 180;
  let count = 0;
  // Use a window of 3 to smooth out noise before angle check
  const smoothed = smooth(pts, 3);

  for (let i = 1; i < smoothed.length - 1; i++) {
    const a = smoothed[i - 1];
    const b = smoothed[i];
    const c = smoothed[i + 1];

    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };

    const magAB = Math.hypot(ab.x, ab.y);
    const magCB = Math.hypot(cb.x, cb.y);
    if (magAB < 0.005 || magCB < 0.005) continue;

    const cosA = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / (magAB * magCB)));
    const angle = Math.acos(cosA);

    if (angle < thresh) count++;
  }
  return count;
}

function smooth(pts, window) {
  return pts.map((p, i) => {
    const start = Math.max(0, i - window);
    const end = Math.min(pts.length - 1, i + window);
    const slice = pts.slice(start, end + 1);
    return getCentroid(slice);
  });
}

function downsample(pts, n) {
  if (pts.length <= n) return pts;
  const result = [];
  const step = (pts.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    result.push(pts[Math.round(i * step)]);
  }
  return result;
}

function getCentroid(pts) {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function getBoundingBox(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function euclidean(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
