/**
 * HUD — sparse typographic layer (idle + drawing only).
 * White text on dark/webcam background.
 */

import { AnimatePresence, motion } from 'framer-motion';

const fade = {
  hidden:  { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.4 } },
};

const MONO  = '"JetBrains Mono", monospace';
const SERIF = '"Cormorant Garamond", serif';

export default function HUD({ phase }) {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 50 }}>

      {/* Top-left credit */}
      <AnimatePresence>
        {(phase === 'idle' || phase === 'drawing') && (
          <motion.div
            key="credit"
            className="absolute"
            style={{ top: 36, left: 44 }}
            variants={fade} initial="hidden" animate="visible" exit="exit"
          >
            <p style={{ fontFamily: SERIF, fontSize: 'clamp(1rem, 1.8vw, 1.5rem)',
              fontWeight: 300, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)' }}>
              SURREAL HANDS
            </p>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.32em',
              color: 'rgba(255,255,255,0.25)', marginTop: 5, textTransform: 'uppercase' }}>
              After Salvador Dalí
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-centre instruction */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center">
        <AnimatePresence mode="wait">

          {phase === 'idle' && (
            <motion.p key="idle"
              variants={fade} initial="hidden" animate="visible" exit="exit"
              style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.42em',
                color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase' }}>
              Raise your index finger and draw a loop
            </motion.p>
          )}

          {phase === 'drawing' && (
            <motion.div key="drawing" className="flex flex-col items-center gap-2"
              variants={fade} initial="hidden" animate="visible" exit="exit">
              <motion.span
                style={{ display: 'block', width: 5, height: 5, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.45)' }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.38em',
                color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase' }}>
                Close the loop to capture the shape
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Watermark */}
      <p style={{
        position: 'absolute', bottom: 22, right: 40,
        fontFamily: MONO, fontSize: '9px', letterSpacing: '0.25em',
        color: 'rgba(255,255,255,0.10)',
      }}>
        © SURREAL HANDS
      </p>
    </div>
  );
}
