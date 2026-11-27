import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  // Pre-bundle everything up front so a lazily-discovered dep can't
  // trigger a re-optimize that loads a second copy of React.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'three', '@react-three/fiber', 'zustand'],
  },
});
