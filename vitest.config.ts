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
    // controlled-fs runs its own lane suite here too. The a5p5-tools lane
    // joined in the GLUE-2 round (gap C-11, coordinator queue; SAME round as
    // its tsconfig.build compile face and the dormant-audit release — the
    // three moves were disclosed as must-be-together in WIRING-SURFACE.md,
    // and this file is outside the packages/ scan universe of that audit, so
    // THIS comment is the disclosure): root CI now collects its six suites;
    // the lane's own runner stays valid for lane-local work.
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/runtime/controlled-fs/test/**/*.test.ts',
      'packages/tools/a5p5-tools/test/**/*.test.ts',
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
      // U7-9a golden RECORDER (authoring-time provenance, mirrors the
      // u6-pr2 `z-u6pr2-golden-recorder.scratch.test.ts` it is kept beside):
      // it imports a DETACHED `origin/master` git worktree to prove the
      // write/edit/read_image corpus is byte-identical cross-tree, so it can
      // only run at authoring (the worktree is transient). NOT part of the
      // shipped suite — the pinned digest in
      // `u7-9a-mutation-golden-vectors.test.ts` guards drift in CI. Excluded
      // so the root run stays deterministic without that worktree present.
      '**/*.scratch.test.ts',
    ],
    environment: 'node',
    pool: 'threads',
  },
})
