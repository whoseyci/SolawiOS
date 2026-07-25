import { defineConfig } from 'vite';

/**
 * Build output goes to server-cf/public so ONE Worker serves both the API and
 * the app — a single deploy, no separate Pages project (docs/61 §Technik).
 */
export default defineConfig({
  build: {
    outDir: '../server-cf/public',
    emptyOutDir: true,
    target: 'es2022',
    // Old phones in fields: keep the bundle small and inspectable.
    minify: 'esbuild',
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/health': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
