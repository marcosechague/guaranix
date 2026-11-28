import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each file starts its own in-memory Postgres (PGlite) and runs the migrations;
    // on a busy CI runner that alone can pass Vitest's 10 s default.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
