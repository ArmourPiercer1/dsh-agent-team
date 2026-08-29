import { defineConfig } from 'vitest/config'

/**
 * Runner is kept fully in-process: worker_threads pool (no child_process
 * fork) and preserved symlink paths (no Windows safe-real-path exec probe).
 * Sandboxed Windows environments deny child spawning with piped stdio
 * (EPERM); these settings make the suite pass there and everywhere else.
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
