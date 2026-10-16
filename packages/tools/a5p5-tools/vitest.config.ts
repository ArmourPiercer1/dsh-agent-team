import { defineConfig } from 'vitest/config'

/**
 * Lane-local runner for `a5p5-tools` (Alpha.5 PR5 Phase 1, DORMANT).
 *
 * Deliberately SEPARATE from the shared `packages/tools/vitest.config.ts`:
 * that config includes `test/**` at the package root and MUST keep ignoring
 * this directory (lane rule: no shared barrel/registry/tsconfig/scanner
 * edits). Same in-process runner law as the shared config — threads pool, no
 * child_process fork, preserved symlinks (sandbox spawn constraints).
 */
export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    pool: 'threads',
  },
})
