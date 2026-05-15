import { useEffect, useState } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';

export default function WebcamLayer({ videoRef, onFingertip, onHandData, enabled }) {
  const [camReady, setCamReady] = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let stream = null;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play().then(() => setCamReady(true));
      } catch (err) {
        setError(err.message);
      }
    }
    start();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [videoRef]);

  useHandTracking({ videoRef, onFingertip, onHandData, enabled: enabled && camReady });

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <p className="font-mono text-white/40 text-xs tracking-widest text-center px-8 uppercase">
          Camera unavailable — {error}
        </p>
      </div>
    );
  }

  return null;
}
