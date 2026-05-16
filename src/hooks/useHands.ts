import { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, HandsConfig, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export type HandLandmark = { x: number; y: number; z: number };

export function useHands() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [isReady, setIsReady] = useState(false);
  const handsRef = useRef<Hands | null>(null);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((res) => {
      setResults(res);
    });

    handsRef.current = hands;

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 1280,
        height: 720,
      });

      camera.start().then(() => setIsReady(true));
    }

    return () => {
      hands.close();
    };
  }, []);

  return { videoRef, results, isReady };
}
