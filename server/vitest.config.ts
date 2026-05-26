import { defineConfig } from 'vitest/config';

/**
 * Server tests run on Node, never in a DOM, and never load the root
 * vite.config.ts. Keeping this isolated is the Phase 0.1 safeguard.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    globals: false,
    css: false,
  },
});
