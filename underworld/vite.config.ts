import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `--mode artifact` builds one self-contained bundle (relative paths, no
// chunk split) that scripts/make-artifact.mjs inlines into a single HTML page.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
  base: artifact ? './' : '/',
  plugins: [react()],
  server: { host: true, port: 5173 },
  // Pre-bundle everything up front so a lazily-discovered dep can't
  // trigger a re-optimize that loads a second copy of React.
  build: {
    outDir: artifact ? 'dist-artifact' : 'dist',
    chunkSizeWarningLimit: artifact ? 2000 : 800,
    rollupOptions: {
      output: {
        // three.js is most of the bundle; keep it in its own long-cached chunk
        manualChunks: artifact ? undefined : { three: ['three'], react: ['react', 'react-dom', '@react-three/fiber', 'zustand'] },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'three', '@react-three/fiber', 'zustand'],
  },
};
});
