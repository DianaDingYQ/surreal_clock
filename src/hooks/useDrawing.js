/**
 * useDrawing
 *
 * Tracks finger path and detects shape closure.
 *
 * Closure: when the path end comes within CLOSE_THRESHOLD px of the start,
 * AND the path has at least MIN_PTS points (prevents tiny accidental closures).
 * Fires onShapeClosed(path) once, then locks until clearPath() is called.
 *
 * Fallback: if the user pauses for PAUSE_MS without closing, fires onShapeClosed
 * anyway (open path — still valid for generation).
 */

import { useRef, useCallback } from 'react';

const MIN_MOVE = 0.003;   // normalized — filters jitter
const PAUSE_MS = 2000;    // pause-to-confirm fallback
const MAX_PTS = 1400;     // cap path length
const MIN_PTS = 25;       // minimum points before closure is considered

export function useDrawing({ onShapeClosed }) {
  const pathRef = useRef([]);
  const closedRef = useRef(false);   // prevent double-fire
  const pauseTimerRef = useRef(null);
  const lastPosRef = useRef(null);
  const isDrawingRef = useRef(false);

  const fireClosed = useCallback(
    (pts) => {
      if (closedRef.current) return;
      closedRef.current = true;
      clearTimeout(pauseTimerRef.current);
      onShapeClosed([...pts]);
    },
    [onShapeClosed]
  );

  const resetPauseTimer = useCallback(() => {
    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      if (pathRef.current.length >= MIN_PTS) {
        fireClosed(pathRef.current);
      } else {
        isDrawingRef.current = false;
      }
    }, PAUSE_MS);
  }, [fireClosed]);

  const addPoint = useCallback(
    ({ x, y, detected }) => {
      if (closedRef.current) return; // shape already captured

      if (!detected) {
        if (isDrawingRef.current && pathRef.current.length >= MIN_PTS) {
          resetPauseTimer();
        }
        return;
      }

      // Jitter filter
      const last = lastPosRef.current;
      if (last && Math.hypot(x - last.x, y - last.y) < MIN_MOVE) return;
      lastPosRef.current = { x, y };
      isDrawingRef.current = true;

      const px = x * window.innerWidth;
      const py = y * window.innerHeight;

      pathRef.current = [...pathRef.current, { x: px, y: py }].slice(-MAX_PTS);

      // ── Closure detection ────────────────────────────────────────────────
      // Dynamic threshold: 4% of short screen dimension, min 30px
      const threshold = Math.max(30, Math.min(window.innerWidth, window.innerHeight) * 0.04);
      const start = pathRef.current[0];
      const len = pathRef.current.length;

      if (len >= MIN_PTS && Math.hypot(px - start.x, py - start.y) < threshold) {
        // Snap last point exactly to start for a clean closed path
        pathRef.current[pathRef.current.length - 1] = { x: start.x, y: start.y };
        fireClosed(pathRef.current);
        return;
      }

      resetPauseTimer();
    },
    [fireClosed, resetPauseTimer]
  );

  const clearPath = useCallback(() => {
    clearTimeout(pauseTimerRef.current);
    pathRef.current = [];
    lastPosRef.current = null;
    isDrawingRef.current = false;
    closedRef.current = false;
  }, []);

  return { addPoint, clearPath, pathRef };
}
