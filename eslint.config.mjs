// @ts-check
/**
 * ESLint 9 flat config — minimal rule set for the dsh-agent-team workspace.
 *
 * Lints the workspace source (packages/**, scripts/**, root configs).
 * Toolchain/provenance inputs (dev/**, docs/**) and build output are not
 * linted sources and are ignored.
 */
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/composition-shim/**',
      '**/node_modules/**',
      '.worktrees/**',
      'references/**',
      // Gitignored raw-evidence scratch (sanitizer inputs, incl. its .sanitized-tmp
      // working copy). Product lint coverage is unchanged; without this line a
      // local evidence mirror changes `pnpm lint` counts, which made an exact-base
      // comparison report +67 phantom errors in the 0.2.0-rc.2 round.
      // Workspace scratch that lives INSIDE the repo root in this environment:
      // pnpm stores, caches, XDG homes, evidence mirrors and test worlds. ESLint 9
      // does not read .gitignore, so without these entries `eslint .` traverses them
      // -- measured: 13 dot-directories were in lint scope at 11e1609c, and
      // `.pnpm-store/v11/tmp/_tmp_*` files vanish between the directory scan and the
      // read, so `pnpm lint` crashed with ENOENT (exit 2) instead of reporting.
      // `.tmp-*/**` is a pattern so a new scratch directory cannot re-break the gate.
      '.tmp-*/**',
      // The `.tmp-*/**` pattern above is ROOT-ANCHORED, so it never reached the fixture
      // scratch the suites build under their own packages: `packages/testkit/test/.tmp-fault/`
      // was in the lint universe (measured: a file placed there is linted by `eslint .`, which
      // reports 1103 files with a fixture present and 1102 without). That directory is created
      // and `rmSync`ed by the suite that owns it, so during any root run the scan walks a tree
      // that is being deleted underneath it — measured, 3 of 3 attempts: `eslint` exits 2 with
      // `Error: ENOENT: no such file or directory, open '…/.tmp-fault/repo/scripts/h1.mjs'` at
      // `eslint-helpers.js readAndVerifyFile`, printing no JSON, which reaches §7.6's lint leg
      // as `NOT RUN` (the flake class reported against the root suite). Contention was measured
      // and excluded: four concurrent full scans, and one running against a heavy vitest file,
      // all exited 1 with complete JSON.
      //
      // The exclusion is identity-NEUTRAL in a quiet tree — measured 62 identities with the
      // pattern, without it, and with fixtures present. It is not a reflexive "ignored files
      // are invisible" move either: a scratch file a HUMAN leaves at the root stays in scope
      // on purpose (that is what `pnpm lint` shows them), and the universe the scan read is
      // printed by `scripts/lint-identities.mjs` on every run. What is removed here is a tree
      // that exists only while a test is running — an identity that appears and disappears with
      // test execution cannot belong to a baseline, and its copies of `scripts/**` are
      // digest-compared to the originals, which ARE linted.
      '**/.tmp-fault/**',
      '.pnpm-store/**',
      '.pnpm-store-testuse/**',
      '.agents/**',
      '.dsh-vision-toolkit/**',
      '.private-raw-evidence/**',
      'dev/**',
      'docs/**',
      'tests/**',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node scripts (composition smoke, future verify-* scripts) run under
    // node, so node globals are defined there only. TypeScript package code
    // stays global-free: the client half must remain browser-safe.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Plain-Node harness / e2e runner scripts (and the two node-side plugin
    // modules) run under node: node globals are defined for exactly these
    // .mjs files, mirroring the scripts/** block above.
    files: [
      'packages/tools/harness/**/*.mjs',
      'packages/runtime/member-residency/harness/**/*.mjs',
      'packages/runtime/root-binding/harness/**/*.mjs',
      'packages/legacy/session-reader/e2e/**/*.mjs',
      'packages/runtime/test/t12a-live-bridge.mjs',
      'packages/runtime/src/plugin/upstream-resolver.mjs',
      'packages/runtime/src/plugin/live/agent-bindings.mjs',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
