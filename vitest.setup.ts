/**
 * Vitest setup file — runs before every test file.
 *
 * Tells React we are inside an act() test environment, so
 * @testing-library/react's render() doesn't blow up under
 * jsdom with "act(...) is not supported in production builds
 * of React".
 *
 * Note: we do NOT set `process.env.NODE_ENV = 'test'` here.
 * Two reasons:
 *   1. `vitest.config.ts` already inlines it via vite's
 *      `define` block — running it first is a no-op and the
 *      vite define still wins for static replacement.
 *   2. `next build` runs `tsc --noEmit` over this file
 *      (we're inside the `**\/*.ts` include glob). Assigning
 *      to `process.env.NODE_ENV` is a read-only property in
 *      TypeScript's type defs, so the build fails with
 *      "Cannot assign to 'NODE_ENV' because it is a read-only
 *      property". The setup file is only meaningful at test
 *      time, but the build doesn't know that. Keep this file
 *      runtime-only — no `process.env` mutations here.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
