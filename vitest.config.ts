import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Pull esbuild's transform helper from vite's own deps
// (vite is a direct dep of vitest, so the require resolves
// cleanly without needing a bare-name import in this file).
const { transformWithEsbuild } = require('vite') as {
  transformWithEsbuild: (
    code: string,
    filename: string,
    options?: Record<string, unknown>,
  ) => Promise<{ code: string; map?: unknown }>;
};

/**
 * Minimal JSX/TSX pre-transform plugin for vitest 4 / vite 8.
 *
 * Why this exists: vite 8's import-analysis plugin uses
 * es-module-lexer to extract imports/exports from a source
 * file BEFORE the file is transformed. es-module-lexer is a
 * pure-JS parser that does NOT understand JSX/TSX syntax, so
 * any `.tsx` file containing `<Foo />` fails the import
 * analysis with "Failed to parse source for import analysis".
 *
 * The fix is to transform `.tsx` files to plain JS with
 * esbuild BEFORE vite runs the import-analysis pass. Once
 * the file is plain JS, es-module-lexer is happy, and the
 * downstream oxc/esbuild transform still works as before.
 *
 * We use the `enforce: 'pre'` hook + `load` (instead of
 * `transform`) so the transformed source replaces the
 * original on disk-read. We return `code` + `map: null` so
 * vite uses our JS.
 */
function tsxToJsPlugin() {
  return {
    name: 'udgok:tsx-to-js',
    enforce: 'pre' as const,
    async load(id: string) {
      if (!id.endsWith('.tsx')) return null;
      // node_modules .tsx files (e.g. test renderers) are
      // handled by vite's optimizer — skip them.
      if (id.includes('/node_modules/')) return null;
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(id, 'utf8');
      const result = await transformWithEsbuild(source, id, {
        loader: 'tsx',
        // `jsx: 'automatic'` is the React 17+ transform —
        // emits `import { jsx } from 'react/jsx-runtime'`.
        // We're stripping the JSX down to a known shape so
        // that es-module-lexer can extract imports; the
        // downstream vite transform replaces the file again
        // before execution, so the actual runtime semantics
        // are unaffected.
        jsx: 'automatic',
        target: 'es2020',
        sourcemap: false,
      });
      return { code: result.code, map: null };
    },
  };
}

export default defineConfig({
  plugins: [tsxToJsPlugin()],
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'tests/e2e/**'],
    // Per-file environment override: tests that render React
    // hooks with @testing-library/react need a DOM. Each
    // such test file opts in with a `// @vitest-environment jsdom`
    // directive at the top. jsdom is already a transitive
    // dep via @testing-library/react.
    setupFiles: ['./vitest.setup.ts'],
    env: {
      // Tests run without a real database / Clerk / Resend,
      // but a few libs (env.ts, lib/blob, lib/email) read env
      // at import time. Pre-populate enough vars to satisfy
      // `required()` in lib/env.ts so module imports don't
      // throw before the test even starts. Tests that need
      // a specific value mock the @/lib/env module directly.
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
  define: {
    // React's index.js switches between dev/prod builds
    // based on process.env.NODE_ENV. Without this define,
    // vite's import-analysis sets it to 'production' before
    // the test runtime reads React, and we hit
    // "act(...) is not supported in production builds of
    // React" from @testing-library/react.
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
