import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The boot-seam lane's host-free arm runner (the boot resume loop against a
 * concurrent archive). Root = this evidence directory (outside `packages/**`,
 * so it enters no scan/census set); the arms drive the REAL
 * `agent-bindings.mjs` through the t12a live bridge and the REAL lifecycle
 * service. Changes no product file and is not part of the product suite.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { preserveSymlinks: true },
  test: {
    include: ['boot-seam-arms.test.mjs'],
    environment: 'node',
    pool: 'threads',
    testTimeout: 30_000,
  },
})
