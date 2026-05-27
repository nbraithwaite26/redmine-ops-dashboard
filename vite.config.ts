/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Azure App Service serves the app at the site root. Base defaults to '/';
// override with VITE_BASE for sub-path hosting (e.g. GitHub Pages).
const base = (globalThis as any).process?.env?.VITE_BASE ?? '/';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['server/**', 'node_modules/**', 'dist/**'],
  },
});
