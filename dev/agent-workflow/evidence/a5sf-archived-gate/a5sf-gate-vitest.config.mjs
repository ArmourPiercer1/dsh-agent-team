import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The archived-gate lane's host-free arm runner. Root = this evidence
 * directory (outside `packages/**`, so it enters no scan/census set); the
 * arms drive the REAL `agent-bindings.mjs` through the t12a live bridge.
 * Changes no product file and is not part of the product suite.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { preserveSymlinks: true },
  test: {
    include: ['row6-rejudge.test.mjs', 'row6-durable-read.test.mjs'],
    environment: 'node',
    pool: 'threads',
  },
})
