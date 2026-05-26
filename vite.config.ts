/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set `base` to the repo name for GitHub Pages hosting under /<repo>/
// Override with VITE_BASE env var when deploying elsewhere.
const base = (globalThis as any).process?.env?.VITE_BASE ?? '/redmine-ops-dashboard/';

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
