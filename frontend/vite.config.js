import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server on port 3000; API calls to /api are forwarded to the backend on port 4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  preview: { port: 3000 },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        // Split large libraries into their own files so the app loads faster
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
