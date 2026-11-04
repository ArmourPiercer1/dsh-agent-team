import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The row-6 RED arm runner. Kept in the evidence tree (outside `packages/**`,
 * so it enters no scan/census set) and pointed at ONE file: the arm drives the
 * REAL `agent-bindings.mjs` source through the t12a live bridge, which imports
 * the TypeScript sources the product test runner resolves. It is NOT part of
 * the product suite and changes no product file.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { preserveSymlinks: true },
  test: {
    include: ['row6-red-arm.test.mjs'],
    environment: 'node',
    pool: 'threads',
  },
})
