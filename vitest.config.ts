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
    // G-d integration wiring round (branch `alpha5-int-wiring`): the two
    // Alpha.5 lane suites with shared-surface stakes join the CI-collectable
    // set (INTEGRATION-PLAN default ruling "加 include 以进 CI 门").
    // controlled-fs runs its own lane suite here too; the a5p5-tools lane
    // stays on its own runner this round (its dormant-audit walks the SHARED
    // config set and must not see its lane named in root glue until the
    // PR5-assembly round wires it — registered in WIRING-SURFACE.md §line-7).
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/runtime/controlled-fs/test/**/*.test.ts',
    ],
    // EVIDENCE-ONLY file (PR #31 supplemental S3, evidence-only commit
    // 833c699): the s3-client-generation-spike drives the pristine
    // upstream 0.1.7 client services, which touch `window` at import
    // time — it needs the client package's vitest environment (jsdom
    // setup + the linked-dsh-source-redirect plugin) and is verified at
    // package level:
    //   cd packages/client && npx vitest run test/s3-client-generation-spike.test.ts
    // Excluded from the root (node-environment) suite so the root run
    // stays deterministic. It asserts no product behavior.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/client/test/s3-client-generation-spike.test.ts',
    ],
    environment: 'node',
    pool: 'threads',
  },
})
