import { defineConfig } from 'vitest/config'

// EVIDENCE-ONLY runner for this lane's instruments, which live OUTSIDE the
// `packages` test roots on purpose: the client lane owns its own files and its
// own census entries, so the instrument that measures the client half of the
// finding must not land under the `packages` tree (it would move the nine-root
// census and the p4t6 scan under another lane's ownership). Run from the repo
// root:
//
//   npx vitest run --config dev/agent-workflow/evidence/a4-pr7/corrupt-leg-guard/evidence-runner.config.mts
//
// It asserts no product behaviour and gates nothing; it is the measurement
// behind FINDINGS.md section 9. It lives in the evidence directory so the
// instrument is reproducible from the commit alone.
export default defineConfig({
  resolve: { preserveSymlinks: true },
  test: {
    include: ['dev/agent-workflow/evidence/**/client-view.instrument.test.ts'],
    environment: 'node',
    pool: 'threads',
  },
})
