import { defineConfig } from 'vitest/config';

// Integration tests spin up a real Postgres via testcontainers, so they need Docker.
// See test/README.md for how these are run (and why they're skipped in this sandbox).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int-spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
