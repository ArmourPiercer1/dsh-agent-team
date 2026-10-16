import { defineConfig } from 'vitest/config'

/**
 * A5-PR3 (Lane B, ControlledFs + PoC3) — LANE-LOCAL vitest config.
 *
 * This file lives INSIDE the new lane directory and is the only way the lane
 * suite is executed (see `README.md`): the root config only collects the
 * per-package `test` directories at `packages/<pkg>/test`, which does NOT
 * reach `controlled-fs/test/`, so the root runnable surface is untouched
 * (integration owner wires the lane in after C-ADM freeze — README wiring
 * notes).
 *
 * Same in-process runner law as the root config: worker_threads pool,
 * preserveSymlinks ON — this lane PROVES symlink behaviour itself, the
 * resolver must not pre-resolve what the policy is supposed to police.
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
