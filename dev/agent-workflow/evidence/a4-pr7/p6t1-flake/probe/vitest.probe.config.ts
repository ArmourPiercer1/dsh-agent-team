import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/** Evidence-only runner for the p6t1 scratch repros (not a nine-root spec). */
export default defineConfig({
  root: fileURLToPath(new URL('../../../../../../', import.meta.url)),
  resolve: { preserveSymlinks: true },
  test: {
    include: ['dev/agent-workflow/evidence/a4-pr7/p6t1-flake/probe/**/*.probe.ts'],
    environment: 'node',
    pool: 'threads',
  },
})
