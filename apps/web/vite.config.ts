import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const backend = 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': backend,
      '/auth': backend,
      '/game': backend,
      '/openapi.json': backend,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Split vendor code so no chunk exceeds Vite's 500 kB warning (react + router change rarely: better caching).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 2 },
            // The graph libraries of the admin level preview stay in that lazy page's chunk.
            { name: 'vendor', test: /node_modules[\\/](?!@xyflow|@dagrejs|d3-|classcat|zustand)/, priority: 1 },
          ],
        },
      },
    },
  },
});
