import { defineConfig } from 'vitest/config'
import { createHostVitePlugin } from './tests/next-host/host-vite-adapter.mjs'

/** The Team checkout this config lives in (worktree-safe via import.meta.url). */
const REPO_ROOT = new URL('.', import.meta.url).pathname

/**
 * Runner is kept fully in-process: worker_threads pool (no child_process
 * fork) and preserved symlink paths (no Windows safe-real-path exec probe).
 * Sandboxed Windows environments deny child spawning with piped stdio
 * (EPERM); these settings make the suite pass there and everywhere else.
 */
export default defineConfig({
  plugins: [
    // THE ONE SELECTOR, VITE-SIDE. A bare `@deepseek-ai/*` import from Team
    // code resolves through `tests/next-host/host-select.mjs` (via the shared
    // adapter), so `TEAM_TEST_HOST=next` grades this whole run on rc.5 instead
    // of silently importing the repo's rc.2 install — the false green measured
    // in round 116. With the variable unset the adapter resolves the exact
    // rc.2 files this run always did; host-internal importers are declined so
    // the host's own install still answers for itself.
    createHostVitePlugin({ repoRoot: REPO_ROOT }),
  ],
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    // Every worker proves the host it actually loaded IS the selected host
    // before any test body runs (round 116 measured a green rc.5-selected run
    // that imported rc.2). One line per worker: HOST-VERSION-GUARD.
    setupFiles: ['./tests/next-host/host-version-guard.mjs'],
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
    // B1 (uncollected-test audit 2026-11-15, batch B1): the T5 compatibility
    // suites sit at `packages/<pkg>/compatibility/test/`, TWO levels below the
    // package root, so neither `packages/*/test/**` nor a package `test/**`
    // include reaches them. They were discovered-but-uncollected
    // (dev/ci/uncollected-baseline.json); the compatibility glob below is the
    // one line that puts them in the root population (`pnpm test` / L2 census).
    // Host-free: pure domain code, 76 tests / ~0.5 s.
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/runtime/controlled-fs/test/**/*.test.ts',
      'packages/tools/a5p5-tools/test/**/*.test.ts',
      'packages/*/compatibility/test/**/*.test.ts',
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
    // A6 integration round: the census single-capture runs nine package
    // roots concurrently; the historical 5 s vitest default made two
    // otherwise-green specs (a5g6 install-face render, alpha5-glob X3
    // timeout arm) fail only under that load. This is a harness bound, not
    // a semantics change; each test keeps its own assertions.
    testTimeout: 20_000,
  },
})
