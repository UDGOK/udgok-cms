/**
 * Vitest setup file — runs before every test file.
 *
 * Forces the React build resolution to the dev build
 * (so `act()` from @testing-library/react works under
 * jsdom) and enables the React act-environment flag.
 *
 * `process.env.NODE_ENV = 'test'` is inlined by vite's
 * `define` in vitest.config.ts so React's index.js (which
 * branches on `process.env.NODE_ENV === 'production'`)
 * picks the development build.
 */
process.env.NODE_ENV = 'test';
// Tell React we are inside an act() test environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
