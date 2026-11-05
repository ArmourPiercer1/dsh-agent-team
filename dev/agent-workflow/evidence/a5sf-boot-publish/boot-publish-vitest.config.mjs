import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The BOOT-PUBLISH lane's arm runner. It runs the shared boot-seam arm file
 * (`../a5sf-boot-seam/boot-seam-arms.test.mjs`), because BS4 belongs to that
 * series: BS1/BS2 pin the loop's two refusals, BS3 pins the boot's list budget,
 * and BS4 pins the PUBLISH window between the loop's `liveAgents.set` and the
 * post-loop sweep. One file = one suite = the four legs cannot drift apart.
 *
 * Root = this evidence directory (outside `packages/**`, so it enters no
 * scan/census set). The arms drive the REAL `agent-bindings.mjs` through the
 * t12a live bridge and the REAL lifecycle service; this file changes no
 * product code and is not part of the product suite.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { preserveSymlinks: true },
  test: {
    include: ['../a5sf-boot-seam/boot-seam-arms.test.mjs'],
    environment: 'node',
    pool: 'threads',
    testTimeout: 30_000,
  },
})
