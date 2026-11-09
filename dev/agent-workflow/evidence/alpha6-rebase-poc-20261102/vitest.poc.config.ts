// Alpha.6 rebase PoC — throwaway probe runner (NOT a CI configuration).
// CI never collects these probes: they live outside `packages/*/test/**`.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/**/*.test.ts'],
    environment: 'node',
    pool: 'threads',
    testTimeout: 30_000,
  },
})
