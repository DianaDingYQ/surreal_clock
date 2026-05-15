import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Exclude MediaPipe from pre-bundling — it self-loads WASM assets at runtime
    exclude: ['@mediapipe/hands'],
  },
  server: {
    port: 5173,
  },
});
