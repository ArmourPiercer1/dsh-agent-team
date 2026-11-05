import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The archive-race lane's host-free arm runner (the archive boundary at the
 * PRODUCT order + the concurrent dispatch). Root = this evidence directory
 * (outside `packages/**`, so it enters no scan/census set); the arms drive the
 * REAL `agent-bindings.mjs` through the t12a live bridge and the REAL
 * lifecycle service. Changes no product file and is not part of the product
 * suite.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { preserveSymlinks: true },
  test: {
    include: ['archive-race-arms.test.mjs'],
    environment: 'node',
    pool: 'threads',
    testTimeout: 30_000,
  },
})
