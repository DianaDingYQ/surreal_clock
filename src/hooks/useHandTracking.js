/**
 * useHandTracking
 *
 * MediaPipe Hands via CDN global `window.Hands`.
 * Applies exponential moving-average smoothing to kill high-frequency jitter
 * without adding noticeable lag. Also returns extended hand data (thumb tip,
 * pinch state, velocity) for Phase 3 interaction.
 */

import { useEffect, useRef, useCallback } from 'react';

// Lower alpha = smoother / more lag. 0.28 feels responsive but jitter-free.
const SMOOTH_ALPHA = 0.28;

/**
 * @param {object}   opts
 * @param {React.RefObject<HTMLVideoElement>} opts.videoRef
 * @param {(tip: {x,y,detected}) => void}    opts.onFingertip
 * @param {(data: HandData) => void}          [opts.onHandData]
 * @param {boolean}  opts.enabled
 */
export function useHandTracking({ videoRef, onFingertip, onHandData, enabled }) {
  const handsRef    = useRef(null);
  const rafRef      = useRef(null);
  const runningRef  = useRef(false);

  // EMA state — reset when hand disappears/reappears
  const smoothRef   = useRef({ x: 0.5, y: 0.5, ready: false });
  const prevRef     = useRef({ x: 0.5, y: 0.5 });

  const handleResults = useCallback(
    (results) => {
      if (!results.multiHandLandmarks?.length) {
        smoothRef.current.ready = false;  // reset EMA on hand loss
        onFingertip({ x: 0, y: 0, detected: false });
        onHandData?.({
          index: null, thumb: null,
          pinching: false,
          velocity: { vx: 0, vy: 0, speed: 0 },
        });
        return;
      }

      const lm  = results.multiHandLandmarks[0];
      const tip = lm[8];  // index fingertip
      const thmb = lm[4]; // thumb tip

      const rawX = 1 - tip.x; // mirror for selfie
      const rawY = tip.y;

      prevRef.current = { x: smoothRef.current.x, y: smoothRef.current.y };

      if (!smoothRef.current.ready) {
        smoothRef.current = { x: rawX, y: rawY, ready: true };
      } else {
        smoothRef.current.x = SMOOTH_ALPHA * rawX + (1 - SMOOTH_ALPHA) * smoothRef.current.x;
        smoothRef.current.y = SMOOTH_ALPHA * rawY + (1 - SMOOTH_ALPHA) * smoothRef.current.y;
      }

      const sx = smoothRef.current.x;
      const sy = smoothRef.current.y;
      const vx = sx - prevRef.current.x;
      const vy = sy - prevRef.current.y;

      const thumbX = 1 - thmb.x;
      const thumbY = thmb.y;
      const pinchDist = Math.hypot(rawX - thumbX, rawY - thumbY);

      onFingertip({ x: sx, y: sy, detected: true });
      onHandData?.({
        index: { x: sx, y: sy },
        thumb: { x: thumbX, y: thumbY },
        pinching: pinchDist < 0.06,
        velocity: { vx, vy, speed: Math.hypot(vx, vy) },
      });
    },
    [onFingertip, onHandData]
  );

  useEffect(() => {
    if (!enabled) return;

    if (typeof window.Hands === 'undefined') {
      console.error('[useHandTracking] window.Hands not found — check CDN script in index.html');
      return;
    }

    const hands = new window.Hands({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults(handleResults);
    handsRef.current  = hands;
    runningRef.current = true;

    async function processFrame() {
      if (!runningRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState === 4 && handsRef.current) {
        try { await handsRef.current.send({ image: video }); } catch { /* ignore */ }
      }
      rafRef.current = requestAnimationFrame(processFrame);
    }

    rafRef.current = requestAnimationFrame(processFrame);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      handsRef.current?.close().catch(() => {});
      handsRef.current = null;
    };
  }, [enabled, videoRef, handleResults]);
}
