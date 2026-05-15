/**
 * App — state machine
 *
 *  idle        : Webcam bg + faint oval guide + instruction text
 *  drawing     : User draws a loop; InkCanvas shows the path
 *  preview     : Shape fitted to clean ellipse; ClockPreview shows buttons
 *  generating  : 5-second formation animation (outline → clock body → elements)
 *  interactive : Clock alive + spring physics + proximity/pinch/swipe response
 */

import { useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';

import WebcamLayer      from './components/WebcamLayer';
import GuidePulse       from './components/GuidePulse';
import InkCanvas        from './components/InkCanvas';
import ClockPreview     from './components/ClockPreview';
import GeneratingClock  from './components/GeneratingClock';
import InteractiveClock from './components/InteractiveClock';
import HUD              from './components/HUD';
import NoiseOverlay     from './components/NoiseOverlay';
import ErrorBoundary    from './components/ErrorBoundary';

import { useDrawing }      from './hooks/useDrawing';
import { useAudioEngine }  from './hooks/useAudioEngine';
import { fitEllipseToPath } from './utils/clockGeometry';

export default function App() {
  const [phase, setPhase]       = useState('idle');
  const [fingertip, setFingertip] = useState({ x: 0, y: 0, detected: false });
  const [ellipse, setEllipse]   = useState(null);
  const [rawPath, setRawPath]   = useState(null);
  const [handData, setHandData] = useState(null);

  const phaseRef = useRef('idle');
  const videoRef = useRef(null);
  const audio    = useAudioEngine();

  function go(p) {
    phaseRef.current = p;
    setPhase(p);
  }

  const handleShapeClosed = useCallback((pts) => {
    if (phaseRef.current !== 'drawing') return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const fitted = fitEllipseToPath(pts, W, H);
    setEllipse(fitted);
    setRawPath([...pts]);
    audio.stopDrawingSound();
    audio.playClosureChime();
    go('preview');
  }, [audio]);

  const { addPoint, clearPath, pathRef } = useDrawing({
    onShapeClosed: handleShapeClosed,
  });

  const handleFingertip = useCallback(
    (tip) => {
      setFingertip(tip);
      if (tip.detected && phaseRef.current === 'idle') {
        go('drawing');
        audio.startDrawingSound();
      }
      if (phaseRef.current === 'drawing') addPoint(tip);
      else if (!tip.detected && phaseRef.current === 'drawing') addPoint(tip);
    },
    [addPoint, audio]
  );

  const handleHandData = useCallback((hd) => {
    if (phaseRef.current === 'interactive') {
      setHandData(hd);
    }
  }, []);

  const handleDrawAgain = useCallback(() => {
    clearPath();
    setEllipse(null);
    setRawPath(null);
    setHandData(null);
    go('idle');
  }, [clearPath]);

  const handleMelt = useCallback(() => {
    go('generating');
    audio.playGenerationSound();
  }, [audio]);

  const handleGenerationComplete = useCallback(() => {
    go('interactive');
  }, []);

  const handleReset = useCallback(() => {
    clearPath();
    setEllipse(null);
    setRawPath(null);
    setHandData(null);
    audio.stopProximityHum();
    go('idle');
  }, [clearPath, audio]);

  // Tracking active in idle/drawing/interactive (need hand data for interaction)
  const trackingActive = phase === 'idle' || phase === 'drawing' || phase === 'interactive';

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 overflow-hidden" style={{ background: '#0a0a0c' }}>

        <svg style={{ display: 'none', position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <filter id="clock-distort" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.038 0.022"
                numOctaves="3" seed="5" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise"
                scale="22" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>

        {/* Hidden video element — shared to all canvas components */}
        <video
          ref={videoRef}
          style={{ position: 'fixed', left: -9999, top: -9999, width: 1, height: 1 }}
          muted
          playsInline
        />

        <WebcamLayer
          videoRef={videoRef}
          onFingertip={handleFingertip}
          onHandData={handleHandData}
          enabled={trackingActive}
        />

        {/* Idle: faint oval guide + webcam bg */}
        <AnimatePresence>
          {phase === 'idle' && <GuidePulse key="guide" videoRef={videoRef} />}
        </AnimatePresence>

        {/* Drawing: live ink path */}
        <InkCanvas pathRef={pathRef} fingertip={fingertip} phase={phase} videoRef={videoRef} />

        {/* Preview: fitted clock + buttons */}
        <AnimatePresence>
          {phase === 'preview' && ellipse && (
            <ClockPreview
              key="preview"
              ellipse={ellipse}
              videoRef={videoRef}
              onDrawAgain={handleDrawAgain}
              onMelt={handleMelt}
            />
          )}
        </AnimatePresence>

        {/* Generating: formation animation */}
        <AnimatePresence>
          {phase === 'generating' && ellipse && (
            <GeneratingClock
              key="generating"
              ellipse={ellipse}
              rawPath={rawPath}
              videoRef={videoRef}
              onComplete={handleGenerationComplete}
            />
          )}
        </AnimatePresence>

        {/* Interactive: live deformable clock */}
        <AnimatePresence>
          {phase === 'interactive' && ellipse && (
            <InteractiveClock
              key="interactive"
              ellipse={ellipse}
              videoRef={videoRef}
              handData={handData}
              onReset={handleReset}
              audio={audio}
            />
          )}
        </AnimatePresence>

        {/* Legacy melting phase removed — generating → interactive replaces it */}

        {/* HUD: idle + drawing only */}
        <HUD phase={phase} />

        <NoiseOverlay />
      </div>
    </ErrorBoundary>
  );
}
