import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'tests/e2e/**'],
    // Per-file environment override: tests that render React
    // hooks with @testing-library/react need a DOM. The
    // `// @vitest-environment jsdom` directive at the top of
    // those test files opts in. jsdom is already a transitive
    // dep via @testing-library/react.
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
