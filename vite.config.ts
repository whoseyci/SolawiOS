import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false,
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
  },
});
