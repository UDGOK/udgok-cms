import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'tests/e2e/**'],
    // Per-file environment override: tests that render React
    // hooks with @testing-library/react need a DOM. Each
    // such test file opts in with a `// @vitest-environment jsdom`
    // directive at the top. jsdom is already a transitive
    // dep via @testing-library/react.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
